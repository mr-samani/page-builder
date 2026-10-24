import type { DataSourceSetting } from '../models/DataSourceSetting';
import { normalizeRequest, requestKey } from '../data/request';
import { createScope, type DataScope } from '../data/scope';
import { resolveSettingRequest } from '../data/setting';
import { templateRootsOf, usageOfScope, type PlanItem } from '../data/plan';
import type { DataStore } from '../data/store';
import { DataError, type DataContext, type DataRequest, type DataRow } from '../data/types';

export type CollectionStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'notfound';

export interface CollectionState {
  readonly status: CollectionStatus;
  readonly source: string;
  readonly mode: 'list' | 'single';
  /** rows currently shown (for "keep the old rows while the next page loads") */
  readonly hasRows: boolean;
  readonly loaded: number;
  readonly total?: number;
  /** 1-based; meaningful for `pager` */
  readonly page: number;
  readonly pageCount?: number;
  readonly pageSize: number | null;
  /** there is more to load (`loadMore` / `infinite`) */
  readonly hasMore: boolean;
  readonly error?: DataError;
  /** a `loadMore` failed (the rows already shown are fine) */
  readonly moreFailed?: boolean;
  readonly waitingFor?: readonly string[];
}

export interface CollectionHost {
  /** new rows (replace) or the next slice (`append`) */
  render(rows: DataRow[], info: { append: boolean; request: DataRequest; state: CollectionState }): void | Promise<void>;
  onState?(state: CollectionState): void;
}

export interface CollectionDeps {
  store: DataStore;
  getContext: () => DataContext;
  /** the record this collection lives in (nested lists) */
  getParentScope?: () => DataScope | undefined;
  host: CollectionHost;
}

/**
 * The brain of every data-driven block (collection list, table, record wrapper). No Angular, no DOM:
 *  - resolves the block settings against route/query/parent into a request, skips it while required values are missing
 *  - loads through the DataStore (cache, dedupe, batching) and CANCELS the previous request when the inputs change
 *  - ignores stale answers (a slow page 1 can never overwrite page 2)
 *  - pager / load-more / infinite bookkeeping, 404 signalling for missing records
 */
export class CollectionController {
  private owner?: PlanItem;
  private setting?: DataSourceSetting;
  private projection?: string[] | null;
  private seq = 0;
  private abort?: AbortController;
  private lastKey?: string;
  private loaded = 0;
  private total?: number;
  private lastRequest?: DataRequest;
  private loadingMore = false;
  private cursor: string | null | undefined;
  private lastBatch = 0;
  private destroyed = false;
  private _state: CollectionState = initial('', 'list');

  constructor(private readonly deps: CollectionDeps) {}

  get state(): CollectionState {
    return this._state;
  }

  /** Connect to a block. Call again (and `refresh`) when its settings or template changed. */
  bind(owner: PlanItem): void {
    this.owner = owner;
    this.setting = owner.dataSource as DataSourceSetting;
    this.projection = undefined;
    this.lastKey = undefined;
  }

  /** The template changed (designer): the projection must be recomputed. */
  invalidateTemplate(): void {
    this.projection = undefined;
    this.lastKey = undefined;
  }

  /**
   * Re-evaluates the settings with the current route/query/parent and (re)loads when the request changed.
   * Safe to call as often as you like: an unchanged request is a no-op.
   */
  async refresh(opts: { force?: boolean } = {}): Promise<void> {
    const setting = this.setting;
    if (this.destroyed || !setting?.id) {
      this.abort?.abort();
      this.set(initial(setting?.id ?? '', setting?.mode ?? 'list'));
      return;
    }

    const def = this.deps.store.getDefinition(setting.id);
    const resolved = resolveSettingRequest(setting, this.scope(), { def, fields: this.fields(), loaded: 0 });
    const mode = resolved.mode;

    if (resolved.missing.length) {
      this.abort?.abort();
      this.lastKey = undefined;
      this.loaded = 0;
      this.set({ ...initial(setting.id, mode), status: 'idle', waitingFor: resolved.missing });
      return;
    }

    const key = requestKey(normalizeRequest(resolved.request, def));
    const active = this._state.status === 'ready' || this._state.status === 'empty' || this._state.status === 'loading' || this._state.status === 'notfound';
    if (!opts.force && key === this.lastKey && active) return;
    this.lastKey = key;

    this.abort?.abort();
    const ac = (this.abort = new AbortController());
    const seq = ++this.seq;
    this.lastRequest = resolved.request;
    this.set({ ...this._state, status: 'loading', source: setting.id, mode, error: undefined, moreFailed: undefined, waitingFor: undefined, page: resolved.page, pageSize: resolved.take });

    try {
      const result = await this.deps.store.load(resolved.request, { signal: ac.signal });
      if (seq !== this.seq || this.destroyed) return;

      const rows = mode === 'single' ? result.items.slice(0, 1) : result.items;
      this.loaded = rows.length;
      this.lastBatch = rows.length;
      this.total = result.total;
      this.cursor = result.nextCursor;
      const state = this.stateFor(rows.length ? 'ready' : mode === 'single' ? 'notfound' : 'empty', resolved.request, resolved.page, resolved.take, setting);
      if (state.status === 'notfound') this.deps.getContext().onNotFound?.({ source: setting.id });
      await this.deps.host.render(rows, { append: false, request: resolved.request, state });
      if (seq !== this.seq || this.destroyed) return;
      this.set(state);
    } catch (e) {
      if (seq !== this.seq || this.destroyed) return;
      const err = e as DataError;
      if (err?.code === 'aborted') return;
      this.lastKey = undefined; // an error must be retried by the next refresh
      this.set({ ...this._state, status: 'error', error: err instanceof DataError ? err : new DataError('unknown', String((e as Error)?.message ?? e)) });
    }
  }

  /** `loadMore` / `infinite`: fetch the next slice and append it. */
  async loadMore(): Promise<void> {
    const setting = this.setting;
    if (this.destroyed || !setting?.id || this.loadingMore || this._state.status !== 'ready' || !this._state.hasMore) return;
    const def = this.deps.store.getDefinition(setting.id);
    const resolved = resolveSettingRequest(setting, this.scope(), { def, fields: this.fields(), loaded: this.loaded, cursor: this.cursor ?? null });
    const seq = this.seq;
    this.loadingMore = true;
    this.set({ ...this._state, moreFailed: undefined });
    try {
      const result = await this.deps.store.load(resolved.request, { signal: this.abort?.signal });
      if (seq !== this.seq || this.destroyed) return;
      this.loaded += result.items.length;
      this.lastBatch = result.items.length;
      this.total = result.total ?? this.total;
      this.cursor = result.nextCursor;
      const state = this.stateFor('ready', resolved.request, 1, resolved.take, setting);
      await this.deps.host.render(result.items, { append: true, request: resolved.request, state });
      this.set(state);
    } catch (e) {
      if ((e as DataError)?.code !== 'aborted') this.set({ ...this._state, moreFailed: true, error: e as DataError });
    } finally {
      this.loadingMore = false;
    }
  }

  /** Pager: changes the URL (the page is part of the route, so it is shareable and crawlable). */
  goToPage(page: number): boolean {
    const nav = this.deps.getContext().navigate;
    const param = this.setting?.pagination?.pageParam || 'page';
    if (!nav) return false;
    const n = Math.max(1, Math.trunc(page));
    const max = this._state.pageCount;
    if (max && n > max) return false;
    nav({ [param]: n === 1 ? null : String(n) });
    return true;
  }

  retry(): Promise<void> {
    return this.refresh({ force: true });
  }

  destroy(): void {
    this.destroyed = true;
    this.abort?.abort();
    this.seq++;
  }

  //==================================================================================

  private scope(): DataScope {
    return this.deps.getParentScope?.() ?? createScope(this.deps.getContext());
  }

  /** the fields the template reads — computed with the same function the page planner uses, so both produce the SAME request key */
  private fields(): string[] | undefined {
    if (this.projection === undefined) {
      const u = this.owner ? usageOfScope(templateRootsOf(this.owner)) : undefined;
      this.projection = u && !u.whole ? [...u.fields] : null;
    }
    return this.projection ?? undefined;
  }

  private stateFor(status: CollectionStatus, req: DataRequest, page: number, take: number | null, setting: DataSourceSetting): CollectionState {
    const total = this.total;
    const mode = setting.pagination?.mode ?? 'none';
    const more = mode === 'loadMore' || mode === 'infinite';
    let hasMore = false;
    if (more && take) {
      if (this.cursor !== undefined) hasMore = !!this.cursor; // keyset pagination: the server says
      else if (total !== undefined) hasMore = (setting.skipCount ?? 0) + this.loaded < total;
      else hasMore = this.lastBatch >= take; // unknown total: a full batch suggests there is more
    }
    return {
      status,
      source: setting.id,
      mode: req.mode ?? 'list',
      hasRows: this.loaded > 0,
      loaded: this.loaded,
      total,
      page,
      pageCount: take && total !== undefined && mode === 'pager' ? Math.max(1, Math.ceil(total / take)) : undefined,
      pageSize: take,
      hasMore,
    };
  }

  private set(s: CollectionState): void {
    this._state = s;
    this.deps.host.onState?.(s);
  }
}

function initial(source: string, mode: 'list' | 'single'): CollectionState {
  return { status: 'idle', source, mode, hasRows: false, loaded: 0, page: 1, pageSize: null, hasMore: false };
}
