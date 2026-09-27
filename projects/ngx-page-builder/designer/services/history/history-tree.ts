import { Signal, signal, WritableSignal } from '@angular/core';
import {
  cloneHistoryValue,
  HistoryApply,
  HistoryOperation,
  HistoryPosition,
  HistorySubtree,
  HistoryValue,
  PropertyState,
  serializeHistoryValue,
  validateOperation,
  validateSubtree,
} from './history.service';

export interface HistoryNode {
  readonly id: string;
  readonly parentId: string | null;
  readonly properties: Readonly<Record<string, HistoryValue>>;
  readonly children: readonly string[];
}

/**
 * Indexed, normalized editor model. Each node has its own signal.
 * Property edits touch only that node and the property path, not the tree.
 * Bind each OnPush node component to select(id); track child IDs in @for.
 */
export class HistoryTree {
  private readonly nodes = new Map<string, WritableSignal<HistoryNode | undefined>>();
  private readonly roots = signal<readonly string[]>(Object.freeze([]));
  readonly rootIds = this.roots.asReadonly();

  /** Loading/indexing is O(document size), performed once per document. */
  constructor(document: readonly HistorySubtree[] = []) {
    const copies = cloneHistoryValue(document);
    const ids = new Set<string>();
    for (const node of copies) validateSubtree(node, ids);
    const add = (node: HistorySubtree, parentId: string | null) => {
      this.nodes.set(
        node.id,
        signal(
          Object.freeze({
            id: node.id,
            parentId,
            properties: freezeData(node.properties),
            children: Object.freeze(node.children.map((child) => child.id)),
          }),
        ),
      );
      for (const child of node.children) add(child, node.id);
    };
    for (const node of copies) add(node, null);
    this.roots.set(Object.freeze(copies.map((node) => node.id)));
  }

  select(id: string): Signal<HistoryNode | undefined> {
    const selected = this.nodes.get(id);
    if (!selected) throw new Error(`Unknown node: ${id}`);
    return selected.asReadonly();
  }

  get(id: string): HistoryNode {
    const node = this.nodes.get(id)?.();
    if (!node) throw new Error(`Unknown node: ${id}`);
    return node;
  }

  edit(id: string, path: string[], value: HistoryValue): HistoryOperation {
    return this.propertyChange(id, path, { exists: true, value });
  }

  unset(id: string, path: string[]): HistoryOperation {
    return this.propertyChange(id, path, { exists: false });
  }

  insert(parentId: string | null, index: number, node: HistorySubtree): HistoryOperation {
    return { type: 'insert', position: { parentId, index }, node };
  }

  remove(id: string): HistoryOperation {
    return { type: 'remove', position: this.position(id), node: this.snapshot(id) };
  }

  /** index is the final index AFTER removal, including same-parent moves. */
  move(id: string, parentId: string | null, index: number): HistoryOperation {
    return { type: 'move', id, from: this.position(id), to: { parentId, index } };
  }

  /** Full export only for saving/loading, NEVER needed for an edit or undo. */
  export(): HistorySubtree[] {
    return cloneHistoryValue(this.rootIds().map((id) => this.snapshot(id)));
  }

  /**
   * Stage changed nodes in a small overlay. Commit only after ALL operations
   * validate. Failure preserves node references, signal values and root IDs.
   * No full Map copy, full tree traversal, or full document serialization.
   */
  readonly apply: HistoryApply = (changes) => {
    const operations = cloneHistoryValue(changes);
    for (const operation of operations) validateOperation(operation);
    const pending = new Map<string, HistoryNode | undefined>();
    let roots = this.rootIds();
    const find = (id: string): HistoryNode | undefined => (pending.has(id) ? pending.get(id) : this.nodes.get(id)?.());
    const get = (id: string): HistoryNode => {
      const node = find(id);
      if (!node) throw new Error(`Missing history target: ${id}`);
      return node;
    };
    const children = (id: string | null): readonly string[] => (id === null ? roots : get(id).children);
    const setChildren = (id: string | null, next: string[]) => {
      const frozen = Object.freeze(next);
      if (id === null) roots = frozen;
      else pending.set(id, Object.freeze({ ...get(id), children: frozen }));
    };
    const checkPosition = (id: string, position: HistoryPosition) => {
      if (get(id).parentId !== position.parentId || children(position.parentId)[position.index] !== id) {
        throw new Error(`History position conflict: ${id}`);
      }
    };
    const detach = (id: string, position: HistoryPosition) => {
      checkPosition(id, position);
      const siblings = children(position.parentId).slice();
      siblings.splice(position.index, 1);
      setChildren(position.parentId, siblings);
    };
    const attach = (id: string, position: HistoryPosition) => {
      const siblings = children(position.parentId).slice();
      if (position.index > siblings.length) throw new Error('History insertion index is out of range.');
      siblings.splice(position.index, 0, id);
      setChildren(position.parentId, siblings);
    };
    const snapshot = (id: string): HistorySubtree => {
      const node = get(id);
      return { id, properties: node.properties, children: node.children.map(snapshot) };
    };
    const insert = (node: HistorySubtree, parentId: string | null) => {
      if (find(node.id)) throw new Error(`Duplicate history ID: ${node.id}`);
      pending.set(
        node.id,
        Object.freeze({
          id: node.id,
          parentId,
          properties: freezeData(node.properties),
          children: Object.freeze(node.children.map((child) => child.id)),
        }),
      );
      for (const child of node.children) insert(child, node.id);
    };
    const remove = (id: string) => {
      for (const child of get(id).children) remove(child);
      pending.set(id, undefined);
    };
    for (const operation of operations) {
      switch (operation.type) {
        case 'set': {
          const node = get(operation.id);
          if (
            serializeHistoryValue(readProperty(node.properties, operation.path)) !==
            serializeHistoryValue(operation.before)
          ) {
            throw new Error(`History property conflict: ${operation.id}`);
          }
          pending.set(
            node.id,
            Object.freeze({ ...node, properties: writeProperty(node.properties, operation.path, operation.after) }),
          );
          break;
        }
        case 'insert':
          // Resolve the destination BEFORE adding nodes; never allow self-parenting.
          children(operation.position.parentId);
          insert(operation.node, operation.position.parentId);
          attach(operation.node.id, operation.position);
          break;
        case 'remove':
          checkPosition(operation.node.id, operation.position);
          if (serializeHistoryValue(snapshot(operation.node.id)) !== serializeHistoryValue(operation.node)) {
            throw new Error('History subtree conflict.');
          }
          detach(operation.node.id, operation.position);
          remove(operation.node.id);
          break;
        case 'move': {
          const node = get(operation.id);
          let ancestor = operation.to.parentId;
          while (ancestor !== null) {
            if (ancestor === operation.id) throw new Error('Cannot move a node into its own subtree.');
            ancestor = get(ancestor).parentId;
          }
          detach(node.id, operation.from);
          attach(node.id, operation.to);
          pending.set(node.id, Object.freeze({ ...get(node.id), parentId: operation.to.parentId }));
          break;
        }
      }
    }
    // Angular signal notifications are observed after this synchronous commit.
    for (const [id, node] of pending) {
      const channel = this.nodes.get(id);
      if (node === undefined) {
        channel?.set(undefined);
        this.nodes.delete(id);
      } else if (channel) channel.set(node);
      else this.nodes.set(id, signal(node));
    }
    if (roots !== this.rootIds()) this.roots.set(roots);
    return undefined;
  };

  private propertyChange(id: string, path: string[], after: PropertyState): HistoryOperation {
    const operation: HistoryOperation = {
      type: 'set',
      id,
      path,
      before: readProperty(this.get(id).properties, path),
      after,
    };
    validateOperation(operation);
    return cloneHistoryValue(operation);
  }

  private position(id: string): HistoryPosition {
    const { parentId } = this.get(id);
    const children = parentId === null ? this.rootIds() : this.get(parentId).children;
    return { parentId, index: children.indexOf(id) };
  }

  private snapshot(id: string): HistorySubtree {
    const node = this.get(id);
    return { id, properties: node.properties, children: node.children.map((child) => this.snapshot(child)) };
  }
}

function readProperty(properties: Readonly<Record<string, HistoryValue>>, path: readonly string[]): PropertyState {
  let parent = properties;
  for (const key of path.slice(0, -1)) {
    if (!Object.hasOwn(parent, key)) throw new Error(`Missing property container: ${key}`);
    const value = parent[key];
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('Property paths traverse objects only; replace an array as a value.');
    parent = value;
  }
  const key = path[path.length - 1];
  return Object.hasOwn(parent, key) ? { exists: true, value: parent[key] } : { exists: false };
}

function writeProperty(
  properties: Readonly<Record<string, HistoryValue>>,
  path: readonly string[],
  after: PropertyState,
): Readonly<Record<string, HistoryValue>> {
  const [key, ...rest] = path;
  const next = { ...properties };
  if (rest.length) next[key] = writeProperty(properties[key] as Record<string, HistoryValue>, rest, after);
  else if (after.exists) next[key] = freezeData(after.value);
  else delete next[key];
  return Object.freeze(next);
}

/** Freeze ONLY newly supplied data; unchanged properties are structurally shared. */
function freezeData<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeData(child);
    Object.freeze(value);
  }
  return value;
}
