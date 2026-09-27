import { computed, Injectable, signal } from '@angular/core';
import { PageItem } from 'ngx-page-builder/core';
import { Timeline, HistoryOperation, HistoryApply, HistoryOptions, HistoryChange, Entry } from './types';
import { cloneHistoryValue, validateOperation, serializeHistoryValue, invertOperation, isNoop } from './utils';

export const MAX_HISTORY_ENTRIES = 100;
/** UTF-16 payload budget; excludes the live document and temporary allocations. */
export const MAX_HISTORY_BYTES = 16 * 1024 * 1024;
export const HISTORY_GROUP_DELAY_MS = 500;

/** Delta journal. Provide per editor. record() applies AND records the change. */
@Injectable()
export class HistoryService {
  private readonly state = signal<Timeline>({ entries: [], index: -1, bytes: 0 });
  private readonly active = signal(true);
  private group: { key: string; time: number } | undefined;
  private applying = false;
  readonly enabled = this.active.asReadonly();
  readonly undoCount = computed(() => this.state().index + 1);
  readonly redoCount = computed(() => this.state().entries.length - this.state().index - 1);
  readonly canUndo = computed(() => this.enabled() && this.undoCount() > 0);
  readonly canRedo = computed(() => this.enabled() && this.redoCount() > 0);
  readonly retainedBytes = computed(() => this.state().bytes);

  /** Clear on document switch or external/untracked mutations. No baseline needed. */
  clear(): void {
    this.assertIdle();
    this.state.set({ entries: [], index: -1, bytes: 0 });
    this.endGroup();
  }

  setEnabled(enabled: boolean): void {
    this.assertIdle();
    if (enabled === this.enabled()) return;
    this.clear();
    this.active.set(enabled);
  }

  endGroup(): void {
    this.group = undefined;
  }

  getHistory(): { description?: string; timestamp: number; bytes: number; applied: boolean }[] {
    return this.state().entries.map(({ description, timestamp, bytes }, index) => ({
      description,
      timestamp,
      bytes,
      applied: index <= this.state().index,
    }));
  }

  /**
   * Pass only changed properties/subtrees, NEVER the whole document.
   * Validate and budget first, apply second, commit journal only on success.
   * A batch is one undo step; undo inverts operations in reverse order.
   */
  record(
    change: HistoryOperation | readonly HistoryOperation[],
    apply: HistoryApply,
    options: HistoryOptions = {},
  ): HistoryChange | undefined {
    this.assertIdle();
    const operations = cloneHistoryValue(Array.isArray(change) ? change : [change]) as HistoryOperation[];
    for (const operation of operations) validateOperation(operation);
    const effective = operations.filter((operation) => !isNoop(operation));
    if (!effective.length) return undefined;
    const originalJson = serializeHistoryValue(effective);
    if (!this.enabled()) {
      this.apply(apply, originalJson);
      this.endGroup();
      return { direction: 'record', operations: effective };
    }
    let entry = this.entry(originalJson, options.description);
    const { entries, index } = this.state();
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
      const previous = JSON.parse(entries[index].json) as HistoryOperation[];
      if (previous.length === 1 && effective.length === 1) {
        const a = previous[0],
          b = effective[0];
        if (
          a.type === 'set' &&
          b.type === 'set' &&
          a.id === b.id &&
          serializeHistoryValue(a.path) === serializeHistoryValue(b.path) &&
          serializeHistoryValue(a.after) === serializeHistoryValue(b.before)
        ) {
          const combined = { ...b, before: a.before };
          entry = this.entry(
            serializeHistoryValue(isNoop(combined) ? [] : [combined]),
            options.description ?? entries[index].description,
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
    this.apply(apply, originalJson);
    this.state.set({ entries: retained, index: retained.length - 1, bytes });
    this.group =
      options.groupKey !== undefined && entry.json !== '[]' ? { key: options.groupKey, time: now } : undefined;
    return { direction: 'record', operations: effective };
  }

  undo(apply: HistoryApply): HistoryChange | undefined {
    this.assertIdle();
    if (!this.canUndo()) return undefined;
    const { entries, index, bytes } = this.state();
    const operations = (JSON.parse(entries[index].json) as HistoryOperation[]).reverse().map(invertOperation);
    this.apply(apply, serializeHistoryValue(operations));
    this.state.set({ entries, index: index - 1, bytes });
    this.endGroup();
    return { direction: 'undo', operations };
  }

  redo(apply: HistoryApply): HistoryChange | undefined {
    this.assertIdle();
    if (!this.canRedo()) return undefined;
    const { entries, index, bytes } = this.state();
    const operations = JSON.parse(entries[index + 1].json) as HistoryOperation[];
    this.apply(apply, entries[index + 1].json);
    this.state.set({ entries, index: index + 1, bytes });
    this.endGroup();
    return { direction: 'redo', operations };
  }

  private entry(json: string, description?: string): Entry {
    const bytes = (json.length + (description?.length ?? 0)) * 2;
    if (bytes > MAX_HISTORY_BYTES)
      throw new RangeError('History operation exceeds MAX_HISTORY_BYTES. Keep binary assets outside history.');
    return { json, description, bytes, timestamp: Date.now() };
  }

  private apply(apply: HistoryApply, json: string): void {
    this.applying = true;
    try {
      if (apply(JSON.parse(json)) !== undefined)
        throw new TypeError('HistoryApply must be synchronous and return undefined.');
    } finally {
      this.applying = false;
    }
  }

  private assertIdle(): void {
    if (this.applying) throw new Error('Cannot modify history while applying a transaction.');
  }

  saveEdit(id: string, item: PageItem, item1: PageItem, arg3: string) {
    throw new Error('Method not implemented.');
  }
  saveDelete(id: string | undefined, index: number, item: PageItem, arg3: string) {
    throw new Error('Method not implemented.');
  }
  saveMove(
    id: string,
    id1: string | undefined,
    previousIndex: number,
    id2: string | undefined,
    currentIndex: number,
    arg5: PageItem,
    arg6: string,
  ) {
    throw new Error('Method not implemented.');
  }
  saveAdd(id: string | undefined, currentIndex: number, source: PageItem, arg3: string) {
    throw new Error('Method not implemented.');
  }
}
