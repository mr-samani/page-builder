import { Injectable, signal, computed } from '@angular/core';
import { PageItem, cloneDeep, deepCloneInstance } from 'ngx-page-builder/core';
import { preparePageItems } from '../helper/prepare-page-builder-data';
import { LibConsts } from 'ngx-page-builder/core';
import { sanitizeForStorage } from '../helper/sanitizeForStorage';

/**
 * History action types
 */
type HistoryAction = 'add' | 'delete' | 'edit' | 'move';

/**
 * Base entry
 */
interface HistoryBase {
  id: string; // target item id (for add this is the new item's id)
  action: HistoryAction;
  timestamp: number;
  description?: string;
}

/** add: item was added at parentId,index */
interface AddHistory extends HistoryBase {
  action: 'add';
  parentId?: string | null; // null = root
  index: number;
  itemSnapshot: PageItem;
}

/** delete: item was removed from parentId,index */
interface DeleteHistory extends HistoryBase {
  action: 'delete';
  parentId?: string | null;
  index: number;
  itemSnapshot: PageItem;
}

/** edit: item changed from prevSnapshot => nextSnapshot */
interface EditHistory extends HistoryBase {
  action: 'edit';
  id: string;
  prevSnapshot: PageItem;
  nextSnapshot: PageItem;
}

/** move: item moved from fromParent/fromIndex -> toParent/toIndex */
interface MoveHistory extends HistoryBase {
  action: 'move';
  id: string;
  fromParentId?: string | null;
  fromIndex: number;
  toParentId?: string | null;
  toIndex: number;
  itemSnapshot: PageItem; // snapshot of the item being moved (used for safe reinsertion)
}

type HistoryEntry = AddHistory | DeleteHistory | EditHistory | MoveHistory;

@Injectable({
  providedIn: 'root',
})
export class HistoryService {
  private _history = signal<HistoryEntry[]>([]);
  private _currentIndex = signal<number>(-1);

  readonly canUndo = computed(() => LibConsts.enableHistory && this._currentIndex() >= 0);
  readonly canRedo = computed(() => LibConsts.enableHistory && this._currentIndex() < this._history().length - 1);

  // current entry (not full tree). Consumer can call getHistory() to inspect or apply.
  readonly currentEntry = computed(() => this._history()[this._currentIndex()] ?? null);

  private getSnapshot(item: PageItem) {
    const clonedData = deepCloneInstance(item);
    const data = preparePageItems([clonedData])[0];
    const sanitized = sanitizeForStorage(data);
    return sanitized;
  }

  // ---- public API for recording actions ----

  /** Record an add operation */
  saveAdd(parentId: string | null | undefined, index: number, item: PageItem, description?: string) {
    if (!LibConsts.enableHistory) return;
    const snapshot = this.getSnapshot(item);
    const entry: AddHistory = {
      action: 'add',
      id: snapshot.id!,
      parentId: parentId ?? null,
      index,
      itemSnapshot: snapshot,
      timestamp: Date.now(),
      description,
    };
    this.pushEntry(entry);
  }

  /** Record a delete operation */
  saveDelete(parentId: string | null | undefined, index: number, item: PageItem, description?: string) {
    if (!LibConsts.enableHistory) return;
    const snapshot = this.getSnapshot(item);
    const entry: DeleteHistory = {
      action: 'delete',
      id: snapshot.id!,
      parentId: parentId ?? null,
      index,
      itemSnapshot: snapshot,
      timestamp: Date.now(),
      description,
    };
    this.pushEntry(entry);
  }

  /**
   * Record an edit operation.
   * Coalescing: if last entry is also edit for same id, we merge by replacing nextSnapshot.
   */
  saveEdit(id: string, nextSnapshot: PageItem, prevSnapshot: PageItem, description?: string) {
    if (!LibConsts.enableHistory) return;
    const prev = this.getSnapshot(prevSnapshot);
    const next = this.getSnapshot(nextSnapshot);

    const last = this._history()[this._currentIndex()];
    if (last && last.action === 'edit' && last.id === id) {
      // coalesce: merge into last (update its nextSnapshot)
      const merged: EditHistory = {
        ...(last as EditHistory),
        nextSnapshot: next,
        timestamp: Date.now(),
        description: description ?? last.description,
      };
      const h = this._history().slice();
      h[this._currentIndex()] = merged;
      this._history.set(h);
      return;
    }

    const entry: EditHistory = {
      action: 'edit',
      id,
      prevSnapshot: prev,
      nextSnapshot: next,
      timestamp: Date.now(),
      description,
    };
    this.pushEntry(entry);
  }

  /** Record a move operation */
  saveMove(
    id: string,
    fromParentId: string | null | undefined,
    fromIndex: number,
    toParentId: string | null | undefined,
    toIndex: number,
    itemSnapshot: PageItem,
    description?: string,
  ) {
    if (!LibConsts.enableHistory) return;
    const entry: MoveHistory = {
      action: 'move',
      id,
      fromParentId: fromParentId ?? null,
      fromIndex,
      toParentId: toParentId ?? null,
      toIndex,
      itemSnapshot: this.getSnapshot(itemSnapshot),
      timestamp: Date.now(),
      description,
    };
    this.pushEntry(entry);
  }

  // ---- core helpers for manipulating the history array ----

  private pushEntry(entry: HistoryEntry) {
    // when pushing new entry, discard forward history (standard undo/redo behavior)
    const newHistory = this._history().slice(0, this._currentIndex() + 1);
    newHistory.push(entry);
    this._history.set(newHistory);
    this._currentIndex.set(newHistory.length - 1);

    // Optional: prune history length to some limit (e.g. 200) to avoid unbounded growth
    const MAX = 500;
    if (this._history().length > MAX) {
      const arr = this._history().slice(this._history().length - MAX);
      this._history.set(arr);
      this._currentIndex.set(arr.length - 1);
    }
  }

  clear() {
    this._history.set([]);
    this._currentIndex.set(-1);
  }

  getHistory(): HistoryEntry[] {
    return this._history();
  }

  // ---- undo / redo API ----
  // Both take the current blocks (root array) and return a new array with operation applied.

  undo(allBlocks: PageItem[]): PageItem[] {
    if (!this.canUndo()) return allBlocks;
    const idx = this._currentIndex();
    const entry = this._history()[idx];
    if (!entry) return allBlocks;

    const result = this.applyEntry(allBlocks, entry, true);
    // move back the pointer
    this._currentIndex.set(idx - 1);
    return result;
  }

  redo(allBlocks: PageItem[]): PageItem[] {
    if (!this.canRedo()) return allBlocks;
    const nextIndex = this._currentIndex() + 1;
    const entry = this._history()[nextIndex];
    if (!entry) return allBlocks;

    const result = this.applyEntry(allBlocks, entry, false);
    // advance pointer
    this._currentIndex.set(nextIndex);
    return result;
  }

  // ---- apply a single history entry to blocks ----
  private applyEntry(allBlocks: PageItem[], entry: HistoryEntry, isUndo: boolean): PageItem[] {
    // operate on a deep clone to preserve immutability for caller
    const blocks = cloneDeep(allBlocks);

    // helper: find node by id -> returns { parent, container, index } or null
    const findById = (id: string): { parent: PageItem | null; container: PageItem[]; index: number } | null => {
      const stack: { parent: PageItem | null; container: PageItem[] }[] = [{ parent: null, container: blocks }];
      while (stack.length) {
        const cur = stack.shift()!;
        for (let i = 0; i < cur.container.length; i++) {
          const item = cur.container[i];
          if (item.id === id) return { parent: cur.parent, container: cur.container, index: i };
          if (item.children && item.children.length) {
            stack.push({ parent: item, container: item.children });
          }
        }
      }
      return null;
    };

    // helper: insert snapshot at parentId,index (if parent not found -> append to root)
    const insertAt = (parentId: string | null | undefined, index: number, snapshot: PageItem) => {
      const node = parentId ? findById(parentId) : null;
      const clone = this.getSnapshot(snapshot);
      if (!node) {
        // insert into root at index (clamp index)
        const pos = Math.min(Math.max(0, index), blocks.length);
        blocks.splice(pos, 0, clone);
        return;
      }
      const cont = node.container;
      const pos = Math.min(Math.max(0, index), cont.length);
      cont.splice(pos, 0, clone);
    };

    // helper: remove by id, return removed snapshot or null
    const removeById = (id: string): PageItem | null => {
      const f = findById(id);
      if (!f) return null;
      const [removed] = f.container.splice(f.index, 1);
      return removed;
    };

    // helper: replace by id with snapshot, return true if replaced
    const replaceById = (id: string, snapshot: PageItem): boolean => {
      const f = findById(id);
      if (!f) return false;
      f.container[f.index] = this.getSnapshot(snapshot);
      return true;
    };

    // helper: move id from anywhere to parentId,index (will remove first occurrence)
    const moveTo = (id: string, toParentId: string | null | undefined, toIndex: number, itemSnapshot?: PageItem) => {
      // first remove existing (if present) and keep removed snapshot
      const removed = removeById(id);
      const snapshot = removed ?? (itemSnapshot ? this.getSnapshot(itemSnapshot) : null);
      if (!snapshot) {
        // nothing to insert
        return;
      }
      insertAt(toParentId, toIndex, snapshot);
    };

    // perform action according to entry & isUndo
    switch (entry.action) {
      case 'add': {
        const e = entry as AddHistory;
        if (isUndo) {
          // undo add => remove the item if present
          removeById(e.id);
        } else {
          // redo add => insert at parentId/index (if already exists, skip)
          const exists = findById(e.id);
          if (!exists) {
            insertAt(e.parentId, e.index, e.itemSnapshot);
          }
        }
        break;
      }

      case 'delete': {
        const e = entry as DeleteHistory;
        if (isUndo) {
          // undo delete => re-insert the removed item
          const exists = findById(e.id);
          if (!exists) {
            insertAt(e.parentId, e.index, e.itemSnapshot);
          }
        } else {
          // redo delete => remove by id
          removeById(e.id);
        }
        break;
      }

      case 'edit': {
        const e = entry as EditHistory;
        if (isUndo) {
          // set prevSnapshot (if item found replace; else insert prev)
          const replaced = replaceById(e.id, e.prevSnapshot);
          if (!replaced) {
            // fallback: try insert at root end
            blocks.push(this.getSnapshot(e.prevSnapshot));
          }
        } else {
          // redo -> apply nextSnapshot
          const replaced = replaceById(e.id, e.nextSnapshot);
          if (!replaced) {
            // fallback: insert next
            blocks.push(this.getSnapshot(e.nextSnapshot));
          }
        }
        break;
      }

      case 'move': {
        const e = entry as MoveHistory;
        if (isUndo) {
          // undo move: move from toParent/toIndex back to fromParent/fromIndex
          // remove by id (from wherever it is currently) and insert to fromParent/fromIndex
          moveTo(e.id, e.fromParentId, e.fromIndex, e.itemSnapshot);
        } else {
          // redo move: move id to toParent/toIndex
          moveTo(e.id, e.toParentId, e.toIndex, e.itemSnapshot);
        }
        break;
      }
    }

    return blocks;
  }

  // ---- helpful migration util: convert old full-snapshot history to operation-based entries ----
  /**
   * Convert legacy full-snapshot history format:
   * [{ action, snapshot: PageItem, ... }, ...]
   * into action-based history entries.
   *
   * Note: This attempts to infer minimal operations (add/delete/edit) by comparing consecutive snapshots.
   * It's best-effort; complex diffs may not be perfectly inferred.
   */
  migrateFromFullSnapshots(
    legacy: { action: HistoryAction; snapshot: PageItem; description?: string; timestamp?: number }[],
  ) {
    const newEntries: HistoryEntry[] = [];

    // naive strategy: for each legacy entry, create an entry according to its action but only
    // storing item-specific snapshot and trying to find parent/index from the snapshot.parent (if exists)
    for (const l of legacy) {
      const snap = this.getSnapshot(l.snapshot);
      const ts = l.timestamp ?? Date.now();
      switch (l.action) {
        case 'add':
          newEntries.push({
            action: 'add',
            id: snap.id!,
            parentId: snap.parent && snap.parent.id ? snap.parent.id : null,
            index: 0,
            itemSnapshot: snap,
            timestamp: ts,
            description: l.description,
          } as AddHistory);
          break;
        case 'delete':
          newEntries.push({
            action: 'delete',
            id: snap.id!,
            parentId: snap.parent && snap.parent.id ? snap.parent.id : null,
            index: 0,
            itemSnapshot: snap,
            timestamp: ts,
            description: l.description,
          } as DeleteHistory);
          break;
        case 'edit':
          // legacy snapshot likely stores the full snapshot after edit; we can't infer prev easily,
          // so use the same snapshot as both prev/next (caller should repair if needed)
          newEntries.push({
            action: 'edit',
            id: snap.id!,
            prevSnapshot: snap,
            nextSnapshot: snap,
            timestamp: ts,
            description: l.description,
          } as EditHistory);
          break;
        case 'move':
          newEntries.push({
            action: 'move',
            id: snap.id!,
            fromParentId: snap.parent && snap.parent.id ? snap.parent.id : null,
            fromIndex: 0,
            toParentId: snap.parent && snap.parent.id ? snap.parent.id : null,
            toIndex: 0,
            itemSnapshot: snap,
            timestamp: ts,
            description: l.description,
          } as MoveHistory);
          break;
      }
    }

    // replace history
    this._history.set(newEntries);
    this._currentIndex.set(newEntries.length - 1);
  }
}
