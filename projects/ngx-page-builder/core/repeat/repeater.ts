import { applyBinding, type ApplyOptions, type BoundValues } from '../data/item-binding';
import { createScope, type DataScope } from '../data/scope';
import type { DataContext, DataRow } from '../data/types';
import { registerScope, unregisterScope } from './scope-registry';
import { resolveNodes, type RowPlan } from './row-plan';

export interface RepeaterScheduler {
  /** run `fn` later (idle / next frame). Returns a cancel function. */
  schedule(fn: () => void): () => void;
}

export interface RepeaterOptions {
  container: Element;
  /** rows are kept right after this node (loading / empty messages live BEFORE the rows, never between them). Default: container start. */
  anchor?: Node | null;
  /** an element rendered ONCE through the block pipeline; every row is a deep clone of it */
  prototype: Element;
  plan: RowPlan;
  getContext: () => DataContext;
  parentScope?: () => DataScope | undefined;
  /** field identifying a record between updates → DOM is reused and moved instead of rebuilt */
  keyField?: string;
  /** the designer shows the editable prototype as row 0 → clones start at index 1 */
  indexOffset?: number;
  /** called on every freshly cloned row, before it is bound (e.g. designer: strip edit artifacts) */
  decorate?: (el: Element, row: DataRow, index: number) => void;
  /** slow path for templates that cannot be cloned: build one row through the pipeline (it must bind the row itself) */
  createRow?: (row: DataRow, scope: DataScope, index: number) => Promise<Element>;
  apply?: ApplyOptions;
  onRowRemoved?: (el: Element) => void;
  /** client only: render big lists in slices so the page stays responsive */
  scheduler?: RepeaterScheduler;
  chunkSize?: number;
  progressiveThreshold?: number;
}

interface Entry {
  key: unknown;
  el: Element;
  row: DataRow;
  nodes: (Element | null)[];
  last: BoundValues[];
}

const DEFAULT_CHUNK = 60;
const DEFAULT_THRESHOLD = 300;

/**
 * Renders a list of records as repeated copies of one prototype element.
 *
 *  - ONE `createBlockElement` for the prototype; every row is `cloneNode(true)` + patching of the bound nodes only
 *  - only values that changed touch the DOM (dirty checking per node)
 *  - keyed reconcile: rows are reused/moved by key, appended/removed at the edges, a DocumentFragment is used for bulk inserts
 *  - cancels itself cleanly: a newer `render()` supersedes a running progressive one
 */
export class Repeater {
  private entries: Entry[] = [];
  private token = 0;
  private cancelSlice?: () => void;
  private destroyed = false;
  private readonly byEl = new WeakMap<Element, Entry>();

  constructor(private readonly o: RepeaterOptions) {}

  get length(): number {
    return this.entries.length;
  }

  elements(): Element[] {
    return this.entries.map((e) => e.el);
  }

  /** The record shown by a row element (or a descendant of it). */
  rowOf(node: Node | null): { row: DataRow; index: number; el: Element } | undefined {
    for (let n: Node | null = node; n; n = n.parentNode) {
      const e = this.byEl.get(n as Element);
      if (e) return { row: e.row, index: this.entries.indexOf(e), el: e.el };
    }
    return undefined;
  }

  /** Replaces (or appends to) the rendered rows. Resolves when everything is in the DOM. */
  async render(rows: readonly DataRow[], opts: { append?: boolean } = {}): Promise<void> {
    if (this.destroyed) return;
    const token = ++this.token;
    this.cancelSlice?.();
    this.cancelSlice = undefined;

    const append = !!opts.append;
    const all = append ? [...this.entries.map((e) => e.row), ...rows] : [...rows];
    const total = all.length;

    if (!this.o.plan.cloneable) {
      await this.renderSlow(all, token);
      return;
    }

    const threshold = this.o.progressiveThreshold ?? DEFAULT_THRESHOLD;
    const chunk = this.o.chunkSize ?? DEFAULT_CHUNK;
    if (this.o.scheduler && !append && total > threshold && total > chunk) {
      this.reconcile(all.slice(0, chunk), total, 0);
      await this.renderRest(all, chunk, token, chunk);
      return;
    }
    this.reconcile(append ? (rows as DataRow[]) : all, total, append ? this.entries.length : 0, append);
  }

  /** Applies a changed context (e.g. locale) or mutated rows to the rows already shown, without touching the DOM structure. */
  rebind(): void {
    const n = this.entries.length;
    this.entries.forEach((e, i) => this.bind(e, e.row, i, n));
  }

  clear(): void {
    this.token++;
    this.cancelSlice?.();
    this.removeAll();
  }

  destroy(): void {
    this.destroyed = true;
    this.clear();
  }

  //==================================================================================

  private renderRest(all: DataRow[], from: number, token: number, chunk: number): Promise<void> {
    return new Promise<void>((resolve) => {
      // cancelling a pending slice must also settle the promise of the render that scheduled it
      const later = (fn: () => void) => {
        const cancel = this.o.scheduler!.schedule(fn);
        this.cancelSlice = () => {
          cancel();
          resolve();
        };
      };
      const step = (start: number) => {
        if (token !== this.token || this.destroyed) return resolve();
        this.reconcile(all.slice(start, start + chunk), all.length, this.entries.length, true);
        if (start + chunk >= all.length) return resolve();
        later(() => step(start + chunk));
      };
      later(() => step(from));
    });
  }

  /**
   * @param rows   rows to place (everything unless `append`)
   * @param total  total rows (for $count / $last)
   * @param offset index of rows[0] inside the final list
   */
  private reconcile(rows: DataRow[], total: number, offset: number, append = false): void {
    const key = this.o.keyField;
    const next: Entry[] = [];
    const created: Entry[] = [];

    if (append) {
      next.push(...this.entries);
      rows.forEach((row, i) => {
        const e = this.makeEntry(row, offset + i, total);
        created.push(e);
        next.push(e);
      });
    } else {
      const keyed = !!key && rows.every((r) => r[key] !== undefined && r[key] !== null) && new Set(rows.map((r) => r[key])).size === rows.length;
      const pool = new Map<unknown, Entry>();
      if (keyed) for (const e of this.entries) pool.set(e.key, e);

      rows.forEach((row, i) => {
        let e: Entry | undefined;
        if (keyed) {
          e = pool.get(row[key!]);
          if (e) pool.delete(row[key!]);
        } else e = this.entries[i];
        if (!e) {
          e = this.makeEntry(row, i, total);
          created.push(e);
        } else {
          e.row = row;
          e.key = key ? row[key] : i;
          this.bind(e, row, i, total);
        }
        next.push(e);
      });

      // anything left in the previous list is gone
      const kept = new Set(next);
      for (const old of this.entries) if (!kept.has(old)) this.remove(old);
    }

    this.place(next, created);
    this.entries = next;
    if (append && this.o.plan.usesLoop) next.forEach((e, i) => i < offset && this.bind(e, e.row, i, total)); // $last / $count of earlier rows changed
  }

  private makeEntry(row: DataRow, index: number, total: number): Entry {
    const el = this.o.prototype.cloneNode(true) as Element;
    this.o.decorate?.(el, row, index);
    const e: Entry = { key: this.o.keyField ? row[this.o.keyField] : index, el, row, nodes: resolveNodes(el, this.o.plan), last: [] };
    this.byEl.set(el, e);
    this.bind(e, row, index, total);
    return e;
  }

  private bind(e: Entry, row: DataRow, index: number, total: number): void {
    const off = this.o.indexOffset ?? 0;
    const scope = createScope(this.o.getContext(), row, this.o.parentScope?.(), index + off, total + off);
    registerScope(e.el, scope);
    const plan = this.o.plan.nodes;
    for (let i = 0; i < plan.length; i++) {
      const node = e.nodes[i];
      if (node) e.last[i] = applyBinding(node, plan[i].binding, scope, e.last[i], this.o.apply);
    }
  }

  /** Puts `entries` in the container in order with the fewest DOM operations. */
  private place(entries: Entry[], created: Entry[]): void {
    const c = this.o.container;
    const start = (): Node | null => (this.o.anchor ? this.o.anchor.nextSibling : c.firstChild);

    // bulk insert: nothing was rendered before → one fragment, one insertion
    if (created.length === entries.length && entries.length > 1) {
      const frag = c.ownerDocument.createDocumentFragment();
      for (const e of entries) frag.appendChild(e.el);
      c.insertBefore(frag, start());
      return;
    }
    let cursor = start();
    for (const e of entries) {
      if (e.el === cursor) cursor = cursor.nextSibling;
      else c.insertBefore(e.el, cursor);
    }
  }

  private remove(e: Entry): void {
    unregisterScope(e.el);
    e.el.parentNode?.removeChild(e.el);
    this.o.onRowRemoved?.(e.el);
  }

  private removeAll(): void {
    for (const e of this.entries) this.remove(e);
    this.entries = [];
  }

  //==================================================================================
  // slow path: templates with custom components are built per row (no reuse)

  private async renderSlow(rows: DataRow[], token: number): Promise<void> {
    if (!this.o.createRow) throw new Error('Repeater: the template is not cloneable and no createRow() was provided.');
    const built: Entry[] = [];
    for (let i = 0; i < rows.length; i++) {
      const scope = createScope(this.o.getContext(), rows[i], this.o.parentScope?.(), i, rows.length);
      const el = await this.o.createRow(rows[i], scope, i);
      if (token !== this.token || this.destroyed) {
        el.parentNode?.removeChild(el);
        built.forEach((b) => b.el.parentNode?.removeChild(b.el));
        return;
      }
      registerScope(el, scope);
      const e: Entry = { key: this.o.keyField ? rows[i][this.o.keyField] : i, el, row: rows[i], nodes: [], last: [] };
      this.byEl.set(el, e);
      built.push(e);
    }
    this.removeAll();
    this.place(built, built);
    this.entries = built;
  }
}
