import { computed, Injectable, signal } from '@angular/core';
import { deepCloneInstance, PageItem } from 'ngx-page-builder/core';
import { Timeline, HistoryOperation, HistoryOptions, HistoryChange, Entry, type ActionType } from './types';
import { validateOperation, serializeHistoryValue, invertOperation, isNoop, serializeSafe } from './utils';

export const MAX_HISTORY_ENTRIES = 100;
/** UTF-16 payload budget; excludes the live document and temporary allocations. */
export const MAX_HISTORY_BYTES = 16 * 1024 * 1024;
export const HISTORY_GROUP_DELAY_MS = 500;

/** Delta journal. Provide per editor . */
@Injectable({
  providedIn: 'root',
})
export class HistoryService<T = PageItem> {
  private readonly state = signal<Timeline>({ entries: [], index: -1, bytes: 0 });
  private readonly active = signal(true);
  private group: { key: string; time: number } | undefined;
  private applying = false;
  readonly undoCount = computed(() => this.state().index + 1);
  readonly redoCount = computed(() => this.state().entries.length - this.state().index - 1);
  readonly canUndo = computed(() => this.active() && this.undoCount() > 0);
  readonly canRedo = computed(() => this.active() && this.redoCount() > 0);
  readonly retainedBytes = computed(() => this.state().bytes);

  /** Clear on document switch or external/untracked mutations. No baseline needed. */
  clear(): void {
    this.assertIdle();
    this.state.set({ entries: [], index: -1, bytes: 0 });
    this.endGroup();
  }

  setEnabled(enabled: boolean): void {
    this.assertIdle();
    if (enabled === this.active()) return;
    this.clear();
    this.active.set(enabled);
  }

  endGroup(): void {
    this.group = undefined;
  }

  getHistory() {
    return this.state().entries.map((m, index) => ({
      ...m,
      applied: index <= this.state().index,
    }));
  }

  /**
   * Pass only changed properties/subtrees, NEVER the whole document.
   * Validate and budget first, apply second, commit journal only on success.
   * A batch is one undo step; undo inverts operations in reverse order.
   */
  async record<T>(change: HistoryOperation<T>, options: HistoryOptions = {}): Promise<HistoryChange<T> | undefined> {
    debugger;
    this.assertIdle();
    const operation = (await serializeSafe(change)) as HistoryOperation<T>;
    validateOperation(operation);
    if (isNoop(operation)) return undefined;

    const originalJson = await serializeHistoryValue(operation);

    let entry = this.entry(originalJson, options.description, change.tag, change.type);
    const { entries, index } = this.state();
    // save last modification
    const now = performance.now();
    let merged = false;
    if (
      index >= 0 &&
      index === entries.length - 1 &&
      options.groupKey !== undefined &&
      this.group?.key === options.groupKey &&
      now - this.group.time >= 0 &&
      now - this.group.time <= HISTORY_GROUP_DELAY_MS
    ) {
      const previous = JSON.parse(entries[index].json) as HistoryOperation<T>;
      if (previous && operation) {
        const a = previous,
          b = operation;
        if (
          a.type === 'set' &&
          b.type === 'set' &&
          a.id === b.id &&
          serializeSafe(a.after) === serializeSafe(b.before)
        ) {
          const combined = { ...b, before: a.before };
          entry = this.entry(
            await serializeHistoryValue(combined),
            options.description ?? entries[index].description,
            entries[index].tag,
            entries[index].type,
          );
          merged = true;
        }
      }
    }
    const updated = entries.slice(0, merged ? index : index + 1);
    if (entry.json !== '[]') updated.push(entry);
    let bytes = updated.reduce((sum, item) => sum + item.bytes, 0);
    let first = 0;
    while (updated.length - first > MAX_HISTORY_ENTRIES || bytes > MAX_HISTORY_BYTES) bytes -= updated[first++].bytes;
    const retained = updated.slice(first);

    this.state.set({ entries: retained, index: retained.length - 1, bytes });
    this.group =
      options.groupKey !== undefined && entry.json !== '[]' ? { key: options.groupKey, time: now } : undefined;
    return { direction: 'record', operation: operation };
  }

  undo(): HistoryChange<T> | undefined {
    this.assertIdle();
    if (!this.canUndo()) return undefined;
    const { entries, index, bytes } = this.state();
    const parsed: HistoryOperation<T> = JSON.parse(entries[index].json);
    const operation = invertOperation(parsed);

    this.state.set({ entries, index: index - 1, bytes });
    this.endGroup();
    return { direction: 'undo', operation };
  }

  redo(): HistoryChange<T> | undefined {
    this.assertIdle();
    if (!this.canRedo()) return undefined;
    const { entries, index, bytes } = this.state();
    const operation = JSON.parse(entries[index + 1].json) as HistoryOperation<T>;
    this.state.set({ entries, index: index + 1, bytes });
    this.endGroup();
    return { direction: 'redo', operation };
  }

  private entry(json: string, description?: string, tag?: string, type?: ActionType): Entry {
    const bytes = (json.length + (description?.length ?? 0)) * 2;
    if (bytes > MAX_HISTORY_BYTES)
      throw new RangeError('History operation exceeds MAX_HISTORY_BYTES. Keep binary assets outside history.');
    return { json, description, bytes, timestamp: Date.now(), tag, type };
  }

  private assertIdle(): void {
    if (this.applying) throw new Error('Cannot modify history while applying a transaction.');
  }

  saveEdit(groupKey: string, before: PageItem, after: PageItem, description: string) {
    return this.record(
      {
        type: 'set',
        node: after,
        before,
        after,
        id: groupKey,
        tag: after.tag,
      },
      {
        groupKey,
        description,
      },
    );
  }
  saveDelete(groupKey: string, index: number, item: PageItem, description: string) {
    return this.record(
      {
        id: groupKey,
        type: 'remove',
        node: item,
        index,
        tag: item.tag,
      },
      {
        groupKey,
        description,
      },
    );
  }
  saveMove(
    groupKey: string,
    fromParentId: string | undefined,
    toParentId: string | undefined,
    fromIndex: number,
    toIndex: number,
    node: PageItem,
    description: string,
  ) {
    return this.record(
      {
        type: 'move',
        fromIndex,
        toIndex,
        id: groupKey,
        node,
        tag: node?.tag,
      },
      {
        groupKey,
        description,
      },
    );
  }

  saveAdd(groupKey: string, index: number, source: PageItem, description: string) {
    return this.record(
      {
        id: groupKey,
        type: 'insert',
        node: source,
        index,
        tag: source.tag,
      },
      {
        groupKey,
        description,
      },
    );
  }
}
