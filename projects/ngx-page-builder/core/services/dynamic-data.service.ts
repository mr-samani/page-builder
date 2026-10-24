import { Injectable } from '@angular/core';
import { collectRequests, distinctReady, type PlanItem, type PlannedRequest } from '../data/plan';
import { createScope } from '../data/scope';
import { compileTemplate } from '../data/template';
import { DataStore, type StoreOptions } from '../data/store';
import { legacyToDefinitions, pageValuesFromStructures, rowFromCells, type LegacyOptions } from '../data/legacy';
import type { BatchFetcher, DataContext, DataRow, DataSchema, DataSourceDefinition, PrimeEntry } from '../data/types';
import { DynamicDataStructure, DynamicValueType } from '../models/DynamicData';
import type { IPage } from '../contracts/IPage';

/**
 * The one place the page builder gets data from. One instance per injector, so on the server every request has its own
 * store (no cross-tenant leakage) and in the browser the whole page shares one cache / one batch.
 *
 *   const dd = inject(DynamicDataService);
 *   dd.store.setBatchFetcher(null, createHttpBatchFetcher({ url: '/api/public/data/batch' }));   // production
 *   dd.setContext({ route: { slug }, query });                                                   // on every navigation
 *   dd.prime(serverState)                                                                         // SSR: results shipped with the page
 */
@Injectable({ providedIn: 'root' })
export class DynamicDataService {
  readonly store: DataStore;
  private readonly _context: DataContext = { route: {}, query: {}, page: {}, global: {} };
  private readonly listeners = new Set<() => void>();
  private _legacy: DynamicDataStructure[] = [];
  private legacyIds = new Set<string>();

  constructor() {
    // blocks are created one after another: a short window lets all their requests travel in ONE batch
    this.store = new DataStore({ batchWindowMs: 8 });
    this.store.context = this._context;
  }

  configure(options: StoreOptions): void {
    Object.assign(this.store.options, options);
  }

  //==================================================================================
  // context (route / query / page values)
  //==================================================================================

  get context(): DataContext {
    return this._context;
  }

  /** Merge new values (call on every navigation). Blocks that depend on them refresh themselves. */
  setContext(patch: Partial<DataContext>): void {
    Object.assign(this._context, patch);
    this.store.context = this._context;
    for (const l of [...this.listeners]) l();
  }

  onContextChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  //==================================================================================
  // new API
  //==================================================================================

  register(def: DataSourceDefinition | DataSourceDefinition[] | DynamicDataStructure): void {
    if (Array.isArray(def) || 'id' in def && !('displayName' in def && 'type' in def && !('fetch' in def) && !('rows' in def) && !('fields' in def))) {
      this.store.register(def as DataSourceDefinition | DataSourceDefinition[]);
      return;
    }
    this.store.register(legacyToDefinitions([def as DynamicDataStructure]));
  }

  registerBatchFetcher(fetcher: BatchFetcher, group: string | null = null): void {
    this.store.setBatchFetcher(group, fetcher);
  }

  describe(id: string): DataSchema | undefined {
    return this.store.describe(id);
  }

  /** Field list of a source WITHOUT loading data (the designer used to fetch a full page just to learn the columns). */
  describeAsync(id: string): Promise<DataSchema | undefined> {
    return this.store.describeAsync(id);
  }

  /** Results computed by the server together with the page → the browser never asks for them again. */
  prime(entries: PrimeEntry[]): void {
    this.store.prime(entries);
  }

  /** Every request the page needs (nothing is rendered or fetched). */
  plan(pages: IPage[] | undefined): PlannedRequest[] {
    const roots = bodyRoots(pages);
    return collectRequests(roots, { ctx: this._context, definition: (id) => this.store.getDefinition(id) });
  }

  /**
   * Start loading everything the page needs, in ONE batch, before the first block exists.
   * Returns the promise so SSR can wait for it. Never rejects.
   */
  prefetch(pages: IPage[] | undefined): Promise<void> {
    return this.store.prefetch(distinctReady(this.plan(pages)));
  }

  //==================================================================================
  // legacy API (kept so existing host apps and the old designer parts keep working)
  //==================================================================================

  get dynamicData(): DynamicDataStructure[] {
    return this._legacy;
  }

  /** @deprecated register DataSourceDefinition objects instead. */
  set dynamicData(value: DynamicDataStructure[]) {
    for (const id of this.legacyIds) this.store.unregister(id);
    this.legacyIds.clear();
    this._legacy = value ?? [];
    const defs = legacyToDefinitions(this._legacy);
    defs.forEach((d) => this.legacyIds.add(d.id));
    this.store.register(defs);
    this._context.page = pageValuesFromStructures(this._legacy);
    for (const l of [...this.listeners]) l();
  }

  setLegacyOptions(options: LegacyOptions): void {
    const current = this._legacy;
    for (const id of this.legacyIds) this.store.unregister(id);
    this.legacyIds.clear();
    const defs = legacyToDefinitions(current, options);
    defs.forEach((d) => this.legacyIds.add(d.id));
    this.store.register(defs);
  }

  /** @deprecated use `store.load()`. Returns the old cell format. */
  async getCollectionData(id: string, skip?: number, take?: number, params?: Record<string, unknown>): Promise<DynamicDataStructure[][]> {
    const r = await this.store.load({ source: id, skip: skip ?? 0, take: take ?? null, params });
    return r.items.map(rowToCells);
  }

  /** @deprecated walks up to the nearest block that owns a data source. */
  findNearestDataSource(itemId: string, pageModel?: any): string | undefined {
    let item: any = typeof pageModel?.get === 'function' ? pageModel.get(itemId) : undefined;
    for (let n = item; n; n = n.parent) if (n.dataSource?.id) return n.dataSource.id;
    return undefined;
  }

  invalidateNearestCacheFor(_itemId?: string): void {
    /* nothing is cached per item any more */
  }

  //==================================================================================
  // {{page.value}} placeholders (scalar values of the page: site name, phone …)
  //==================================================================================

  /** Safe replacement for `{{key}}` in rich text: values are HTML-escaped, unknown keys are left as they are. */
  interpolate(content: string): string {
    if (!content || !content.includes('{{')) return content;
    const t = compileTemplate(content);
    // legacy keys were `ns.key`; they are `page.ns.key` in the new scope → accept both
    const scope = createScope(this._context, this._context.page as DataRow);
    const out = t.render(scope, 'html');
    return out;
  }

  /** @deprecated use {@link interpolate} at render time. Kept as the public name the preview service calls. */
  replaceContentValue(content: string): string {
    return this.interpolate(content);
  }

  /**
   * Re-applies page values to blocks whose rich text contains `{{…}}` — per block, never by rewriting the HTML of whole subtrees
   * (the old implementation destroyed every component inside them and inserted data as raw HTML).
   */
  replaceValues(pages: IPage[] | undefined): void {
    const visit = (items: PlanItem[] | undefined) => {
      for (const item of items ?? []) {
        const any = item as any;
        if (typeof any.content === 'string' && any.content.includes('{{') && any.el && !any.customComponent && !(any.children?.length)) {
          any.el.innerHTML = this.interpolate(any.content);
        }
        visit(item.children);
      }
    };
    visit(bodyRoots(pages));
  }
}

function bodyRoots(pages: IPage[] | undefined): PlanItem[] {
  const out: PlanItem[] = [];
  for (const p of pages ?? []) {
    const any = p as any;
    for (const k of ['headerItems', 'bodyItems', 'footerItems']) if (Array.isArray(any[k])) out.push(...any[k]);
  }
  return out;
}

const TYPE: Record<string, DynamicValueType> = { number: DynamicValueType.Int, boolean: DynamicValueType.Boolean, string: DynamicValueType.String };

function rowToCells(row: DataRow): DynamicDataStructure[] {
  return Object.keys(row).map((name) => {
    const v = row[name];
    return { name, displayName: name, type: v instanceof Date ? DynamicValueType.DateTime : (TYPE[typeof v] ?? DynamicValueType.String), value: v as never } as DynamicDataStructure;
  });
}

export { rowFromCells };
