import { computed } from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HistoryService,
  HistoryOperation,
  HistorySubtree,
  MAX_HISTORY_BYTES,
  MAX_HISTORY_ENTRIES,
  HISTORY_GROUP_DELAY_MS,
} from './history.service';
import { HistoryTree } from './history-tree';

const node = (id: string, title = id, children: HistorySubtree[] = []): HistorySubtree => ({
  id,
  properties: { title, style: { color: 'red', size: 12 } },
  children,
});
const setup = (document = [node('a'), node('b')]) => ({
  history: new HistoryService(),
  tree: new HistoryTree(document),
});
afterEach(() => vi.restoreAllMocks());

describe('delta history', () => {
  it('stores only the changed property and returns the applied operations', () => {
    const { history, tree } = setup();
    const result = history.record(tree.edit('a', ['title'], 'new'), tree.apply)!;
    expect(tree.get('a').properties['title']).toBe('new');
    expect(result.operations).toEqual([
      {
        type: 'set',
        id: 'a',
        path: ['title'],
        before: { exists: true, value: 'a' },
        after: { exists: true, value: 'new' },
      },
    ]);
    expect(history.undo(tree.apply)?.operations[0]).toMatchObject({ type: 'set', id: 'a', after: { value: 'a' } });
    expect(tree.get('a').properties['title']).toBe('a');
    expect(history.redo(tree.apply)?.direction).toBe('redo');
    expect(tree.get('a').properties['title']).toBe('new');
    expect(history.redo(tree.apply)).toBeUndefined();
  });

  it('does not change root/sibling/child references or unrelated property branches', () => {
    const { history, tree } = setup([node('p', 'p', [node('a'), node('b')]), node('q')]);
    const roots = tree.rootIds(),
      parent = tree.get('p'),
      sibling = tree.get('b'),
      other = tree.get('q');
    const style = tree.get('a').properties['style'],
      children = tree.get('a').children;
    const signal = tree.select('a');
    history.record(tree.edit('a', ['title'], 'edited'), tree.apply);
    expect(tree.rootIds()).toBe(roots);
    expect(tree.get('p')).toBe(parent);
    expect(tree.get('b')).toBe(sibling);
    expect(tree.get('q')).toBe(other);
    expect(tree.get('a').children).toBe(children);
    expect(tree.get('a').properties['style']).toBe(style);
    expect(signal()?.properties['title']).toBe('edited');
    history.undo(tree.apply);
    expect(tree.get('p')).toBe(parent);
    expect(tree.get('b')).toBe(sibling);
  });

  it('supports missing vs null, nested updates and deletion of properties', () => {
    const { history, tree } = setup();
    history.record(tree.edit('a', ['optional'], null), tree.apply);
    history.record(tree.edit('a', ['style', 'color'], 'blue'), tree.apply);
    history.record(tree.unset('a', ['title']), tree.apply);
    expect(Object.hasOwn(tree.get('a').properties, 'title')).toBe(false);
    history.undo(tree.apply);
    expect(tree.get('a').properties['title']).toBe('a');
    history.undo(tree.apply);
    expect(tree.get('a').properties['style']).toEqual({ color: 'red', size: 12 });
    history.undo(tree.apply);
    expect(Object.hasOwn(tree.get('a').properties, 'optional')).toBe(false);
    history.redo(tree.apply);
    expect(tree.get('a').properties['optional']).toBeNull();
  });

  it('inserts/removes only the relevant subtree at the exact parent and index', () => {
    const { history, tree } = setup([node('p', 'p', [node('a'), node('b')]), node('q')]);
    const q = tree.get('q');
    history.record(tree.insert('p', 1, node('x', 'x', [node('y')])), tree.apply);
    expect(tree.get('p').children).toEqual(['a', 'x', 'b']);
    expect(tree.get('y').parentId).toBe('x');
    const deleted = tree.select('x');
    history.undo(tree.apply);
    expect(deleted()).toBeUndefined();
    expect(() => tree.get('y')).toThrow();
    history.redo(tree.apply);
    expect(tree.get('p').children).toEqual(['a', 'x', 'b']);
    const before = tree.export();
    history.record(tree.remove('p'), tree.apply);
    expect(tree.rootIds()).toEqual(['q']);
    history.undo(tree.apply);
    expect(tree.export()).toEqual(before);
    expect(tree.get('q')).toBe(q);
  });

  it('moves both directions within a parent and between parents without cloning subtree properties', () => {
    const { history, tree } = setup([node('p', 'p', [node('a'), node('b'), node('c')]), node('q')]);
    const props = tree.get('a').properties;
    history.record(tree.move('a', 'p', 2), tree.apply);
    expect(tree.get('p').children).toEqual(['b', 'c', 'a']);
    history.undo(tree.apply);
    expect(tree.get('p').children).toEqual(['a', 'b', 'c']);
    history.redo(tree.apply);
    history.record(tree.move('a', 'q', 0), tree.apply);
    expect(tree.get('q').children).toEqual(['a']);
    expect(tree.get('a').properties).toBe(props);
    history.undo(tree.apply);
    expect(tree.get('p').children).toEqual(['b', 'c', 'a']);
    history.record(tree.move('a', 'p', 0), tree.apply);
    expect(tree.get('p').children).toEqual(['a', 'b', 'c']);
  });

  it('applies a dependent batch as one transaction and reverses its order for undo', () => {
    const { history, tree } = setup();
    const change: HistoryOperation[] = [
      tree.insert(null, 2, node('x')),
      {
        type: 'set',
        id: 'x',
        path: ['title'],
        before: { exists: true, value: 'x' },
        after: { exists: true, value: 'edited' },
      },
      { type: 'move', id: 'x', from: { parentId: null, index: 2 }, to: { parentId: 'a', index: 0 } },
    ];
    history.record(change, tree.apply);
    expect(history.undoCount()).toBe(1);
    expect(tree.get('x').properties['title']).toBe('edited');
    history.undo(tree.apply);
    expect(tree.rootIds()).toEqual(['a', 'b']);
    expect(() => tree.get('x')).toThrow();
    history.redo(tree.apply);
    expect(tree.get('a').children).toEqual(['x']);
  });

  it('leaves the whole batch, references and history untouched when any operation fails', () => {
    const { history, tree } = setup();
    const a = tree.get('a'),
      roots = tree.rootIds();
    const bad: HistoryOperation = {
      type: 'move',
      id: 'missing',
      from: { parentId: null, index: 0 },
      to: { parentId: null, index: 0 },
    };
    // Not a no-op: force validation against the missing target during staging.
    bad.to.index = 1;
    expect(() => history.record([tree.edit('a', ['title'], 'new'), bad], tree.apply)).toThrow();
    expect(tree.get('a')).toBe(a);
    expect(tree.rootIds()).toBe(roots);
    expect(history.undoCount()).toBe(0);
    expect(history.retainedBytes()).toBe(0);
  });

  it('does not move the cursor on failed undo/redo and rejects stale property values', () => {
    const { history, tree } = setup();
    history.record(tree.edit('a', ['title'], 'new'), tree.apply);
    const fail = (): undefined => {
      throw new Error('adapter failure');
    };
    expect(() => history.undo(fail)).toThrow('adapter failure');
    expect(history.undoCount()).toBe(1);
    const stale = tree.edit('a', ['title'], 'later');
    tree.apply([tree.edit('a', ['title'], 'external')]);
    expect(() => history.undo(tree.apply)).toThrow(/conflict/);
    expect(() => history.record(stale, tree.apply)).toThrow(/conflict/);
    tree.apply([tree.edit('a', ['title'], 'new')]);
    history.undo(tree.apply);
    expect(() => history.redo(fail)).toThrow('adapter failure');
    expect(history.redoCount()).toBe(1);
  });

  it('invalidates redo only after a successful real edit, with no merge across undo/redo', () => {
    const { history, tree } = setup();
    history.record(tree.edit('a', ['title'], '1'), tree.apply, { groupKey: 'a:title' });
    history.endGroup();
    history.record(tree.edit('a', ['title'], '2'), tree.apply, { groupKey: 'a:title' });
    history.undo(tree.apply);
    expect(history.record(tree.edit('a', ['title'], '1'), tree.apply)).toBeUndefined();
    expect(history.canRedo()).toBe(true);
    expect(() => history.record(tree.insert('missing', 0, node('x')), tree.apply)).toThrow();
    expect(history.canRedo()).toBe(true);
    history.record(tree.edit('a', ['title'], '3'), tree.apply, { groupKey: 'a:title' });
    expect(history.canRedo()).toBe(false);
    expect(history.undoCount()).toBe(2);
    history.undo(tree.apply);
    expect(tree.get('a').properties['title']).toBe('1');
    history.redo(tree.apply);
    history.record(tree.edit('a', ['title'], '4'), tree.apply, { groupKey: 'a:title' });
    expect(history.undoCount()).toBe(3);
  });

  it('groups only continuous edits of the same property inside the time window', () => {
    let time = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => time);
    const { history, tree } = setup();
    const edit = (value: string) =>
      history.record(tree.edit('a', ['title'], value), tree.apply, { groupKey: 'typing' });
    edit('1');
    time += HISTORY_GROUP_DELAY_MS;
    edit('2');
    expect(history.undoCount()).toBe(1);
    history.record(tree.edit('b', ['title'], 'B'), tree.apply, { groupKey: 'typing' });
    expect(history.undoCount()).toBe(2);
    time += HISTORY_GROUP_DELAY_MS + 1;
    edit('3');
    expect(history.undoCount()).toBe(3);
    edit('2');
    expect(history.undoCount()).toBe(2); // group returned to its starting value
    history.undo(tree.apply);
    expect(tree.get('b').properties['title']).toBe('b');
    history.undo(tree.apply);
    expect(tree.get('a').properties['title']).toBe('a');
  });

  it('bounds entries and preserves the reachable suffix through undo/redo', () => {
    const { history, tree } = setup();
    for (let i = 0; i < MAX_HISTORY_ENTRIES + 10; i++) history.record(tree.edit('a', ['title'], String(i)), tree.apply);
    expect(history.undoCount()).toBe(MAX_HISTORY_ENTRIES);
    for (let i = 0; i < MAX_HISTORY_ENTRIES; i++) history.undo(tree.apply);
    expect(tree.get('a').properties['title']).toBe('9');
    expect(history.undo(tree.apply)).toBeUndefined();
    for (let i = 0; i < MAX_HISTORY_ENTRIES; i++) history.redo(tree.apply);
    expect(tree.get('a').properties['title']).toBe(String(MAX_HISTORY_ENTRIES + 9));
  });

  it('bounds bytes, rejects oversized edits before applying, and preserves redo on failure', () => {
    const { history, tree } = setup();
    const large = 'x'.repeat(Math.floor(MAX_HISTORY_BYTES / 8));
    history.record(tree.edit('a', ['title'], large), tree.apply);
    history.record(tree.edit('a', ['title'], large + '1'), tree.apply);
    history.record(tree.edit('a', ['title'], large + '2'), tree.apply);
    expect(history.undoCount()).toBe(1);
    expect(history.retainedBytes()).toBeLessThanOrEqual(MAX_HISTORY_BYTES);
    history.undo(tree.apply);
    const before = tree.get('a');
    expect(() => history.record(tree.edit('a', ['title'], 'x'.repeat(MAX_HISTORY_BYTES / 2)), tree.apply)).toThrow(
      RangeError,
    );
    expect(tree.get('a')).toBe(before);
    expect(history.canRedo()).toBe(true);
  });

  it('prevents caller/adapter mutations from corrupting the journal', () => {
    const { history, tree } = setup();
    const change = tree.edit('a', ['title'], 'new');
    const report = history.record(change, tree.apply)!;
    if (change.type === 'set') change.after = { exists: true, value: 'corrupt' };
    (report.operations[0] as Extract<HistoryOperation, { type: 'set' }>).before = { exists: true, value: 'corrupt' };
    expect(Reflect.set(tree.get('a').properties, 'title', 'bad')).toBe(false);
    history.undo(tree.apply);
    expect(tree.get('a').properties['title']).toBe('a');
  });

  it('rejects invalid IDs, parent cycles, duplicate subtrees, bad indices and unsafe paths atomically', () => {
    const { history, tree } = setup([node('p', 'p', [node('a')]), node('q')]);
    const original = tree.export();
    const invalid = [
      tree.move('p', 'a', 0),
      tree.insert(null, 0, node('p')),
      tree.insert('missing', 0, node('x')),
      tree.insert(null, 99, node('x')),
      tree.insert(null, -1, node('x')),
      tree.insert(null, 1, node('x', 'x', [node('x')])),
    ];
    for (const operation of invalid) expect(() => history.record(operation, tree.apply)).toThrow();
    expect(() => tree.edit('a', ['__proto__'], {})).toThrow();
    expect(() => tree.edit('a', ['style', 'constructor'], 1)).toThrow();
    expect(() => tree.edit('a', ['title', 'nested'], 1)).toThrow();
    expect(() => tree.edit('a', ['title'], undefined as never)).toThrow();
    expect(tree.export()).toEqual(original);
    expect(history.undoCount()).toBe(0);
    expect(() => new HistoryTree([node('x'), node('x')])).toThrow();
  });

  it('isolates editors, clears on disable, and applies edits while disabled', () => {
    const { history, tree } = setup(),
      other = setup();
    history.record(tree.edit('a', ['title'], 'one'), tree.apply);
    history.setEnabled(false);
    expect(history.canUndo()).toBe(false);
    history.record(tree.edit('a', ['title'], 'two'), tree.apply);
    expect(tree.get('a').properties['title']).toBe('two');
    expect(history.retainedBytes()).toBe(0);
    history.setEnabled(true);
    history.record(tree.edit('a', ['title'], 'three'), tree.apply);
    history.undo(tree.apply);
    expect(tree.get('a').properties['title']).toBe('two');
    expect(other.tree.get('a').properties['title']).toBe('a');
    expect(other.history.canUndo()).toBe(false);
    history.clear();
    expect(history.redoCount()).toBe(0);
  });

  it('rejects reentrant history changes before they can mutate document/history', () => {
    const { history, tree } = setup();
    expect(() =>
      history.record(tree.edit('a', ['title'], 'new'), () => {
        history.clear();
        return undefined;
      }),
    ).toThrow(/transaction/);
    expect(history.undoCount()).toBe(0);
    expect(tree.get('a').properties['title']).toBe('a');
  });

  it('editing node 150 among 10,000 invalidates only its signal and stores the same bytes as a small document', () => {
    const { history, tree } = setup(Array.from({ length: 10000 }, (_, i) => node(String(i))));
    const roots = tree.rootIds();
    const evaluations = new Uint32Array(10000);
    const views = Array.from({ length: 10000 }, (_, i) => {
      const source = tree.select(String(i));
      return computed(() => {
        evaluations[i]++;
        return source()?.properties['title'];
      });
    });
    views.forEach((view) => view());
    history.record(tree.edit('150', ['title'], 'new'), tree.apply);
    views.forEach((view) => view());
    expect(evaluations[150]).toBe(2);
    expect(evaluations.reduce((sum, count) => sum + count, 0)).toBe(10001);
    expect(tree.rootIds()).toBe(roots);
    const small = setup([node('150')]);
    small.history.record(small.tree.edit('150', ['title'], 'new'), small.tree.apply);
    expect(history.retainedBytes()).toBe(small.history.retainedBytes());
    expect(history.retainedBytes()).toBeLessThan(512);
    history.undo(tree.apply);
    views.forEach((view) => view());
    expect(evaluations.reduce((sum, count) => sum + count, 0)).toBe(10002);
  });

  it('matches an independent full-state reference across 3000 random structural/edit/undo/redo operations', () => {
    let document = [node('a'), node('b'), node('p')];
    const { history, tree } = setup(document);
    let past: HistorySubtree[][] = [],
      future: HistorySubtree[][] = [];
    let seed = 987654321,
      nextId = 0;
    const random = (n: number) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return (seed >>> 8) % n;
    };
    const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
    const locations = (
      nodes: HistorySubtree[],
      parentId: string | null = null,
    ): { node: HistorySubtree; siblings: HistorySubtree[]; parentId: string | null; index: number }[] =>
      nodes.flatMap((node, index) => [
        { node, siblings: nodes, parentId, index },
        ...locations(node.children, node.id),
      ]);
    for (let step = 0; step < 3000; step++) {
      const action = random(6);
      if (action === 4) {
        const previous = past.pop();
        const result = history.undo(tree.apply);
        if (previous) {
          future.unshift(document);
          document = previous;
          expect(result).toBeDefined();
        } else expect(result).toBeUndefined();
      } else if (action === 5) {
        const next = future.shift();
        const result = history.redo(tree.apply);
        if (next) {
          past.push(document);
          document = next;
          expect(result).toBeDefined();
        } else expect(result).toBeUndefined();
      } else {
        const before = clone(document);
        const all = locations(document);
        let operation: HistoryOperation;
        if (action === 0 && all.length) {
          const target = all[random(all.length)];
          const title = 'value-' + step;
          operation = tree.edit(target.node.id, ['title'], title);
          target.node.properties['title'] = title;
        } else if (action === 2 && all.length) {
          const target = all[random(all.length)];
          operation = tree.remove(target.node.id);
          target.siblings.splice(target.index, 1);
        } else if (action === 3 && all.length > 1) {
          const leaves = all.filter((item) => !item.node.children.length);
          const target = leaves[random(leaves.length)];
          const destinations = all.filter((item) => item.node.id !== target.node.id);
          const parent = destinations[random(destinations.length)];
          target.siblings.splice(target.index, 1);
          const index = random(parent.node.children.length + 1);
          operation = tree.move(target.node.id, parent.node.id, index);
          parent.node.children.splice(index, 0, target.node);
        } else {
          const parent = all.length && random(2) ? all[random(all.length)].node : undefined;
          const siblings = parent ? parent.children : document;
          const index = random(siblings.length + 1);
          const added = node('new-' + nextId++);
          operation = tree.insert(parent?.id ?? null, index, added);
          siblings.splice(index, 0, added);
        }
        const result = history.record(operation, tree.apply);
        if (JSON.stringify(before) !== JSON.stringify(document)) {
          expect(result).toBeDefined();
          past.push(before);
          past = past.slice(-MAX_HISTORY_ENTRIES);
          future = [];
        }
      }
      expect(tree.export()).toEqual(document);
      expect(history.undoCount()).toBe(past.length);
      expect(history.redoCount()).toBe(future.length);
    }
  });
});
