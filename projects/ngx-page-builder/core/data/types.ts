/**
 * Contracts of the dynamic-data layer.
 *
 * Design rules (they exist so the BACKEND can stay simple and fast):
 *  - rows are plain JSON objects  `{ id: 1, title: 'x' }`   (the legacy `DynamicDataStructure[]` cell objects are only adapters)
 *  - everything on the wire is a string literal / number / boolean (no numeric enums)
 *  - a request carries what the server needs to be efficient: paging, sort, filters, and the exact `fields` the template uses
 */

export type DataRow = Record<string, unknown>;

export type FieldType =
  | 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'time'
  | 'image' | 'url' | 'html' | 'array' | 'object';

export interface FieldDefinition {
  name: string;
  label?: string;
  type?: FieldType;
  sortable?: boolean;
  /** nested fields of an object/array field (used by the field picker) */
  fields?: FieldDefinition[];
}

export type ParamType = 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'autocomplete' | 'date';

export interface ParamDefinition {
  name: string;
  label?: string;
  type?: ParamType;
  /** a request is NOT sent while a required param has no value (e.g. the product page waits for `@route.slug`) */
  required?: boolean;
  defaultValue?: unknown;
  options?: { id: string | number; title: string }[];
}

export type SortDir = 'asc' | 'desc';
export interface SortSpec {
  field: string;
  dir: SortDir;
}

export type PaginationMode = 'none' | 'pager' | 'loadMore' | 'infinite';
export type DataMode = 'list' | 'single';

/** What a block asks for (after parameters are resolved). */
export interface DataRequest {
  source: string;
  skip?: number;
  take?: number | null;
  sort?: SortSpec[];
  params?: Record<string, unknown>;
  /** projection: only these fields are needed by the template → the server can SELECT less */
  fields?: string[];
  search?: string | null;
  mode?: DataMode;
  cursor?: string | null;
}

/** Canonical form of a request. Same input → same object → same key (cache, dedupe, priming). */
export interface NormalizedRequest {
  source: string;
  skip: number;
  take: number | null;
  sort: SortSpec[];
  params: Record<string, unknown>;
  fields: string[];
  search: string | null;
  mode: DataMode;
  cursor: string | null;
}

export interface DataResult<T extends DataRow = DataRow> {
  items: T[];
  /** total rows matching the filter (for pagers). Omit when unknown / expensive. */
  total?: number;
  /** keyset pagination: pass back as `cursor` for the next page */
  nextCursor?: string | null;
  meta?: Record<string, unknown>;
}

export type DataErrorCode =
  | 'network' | 'timeout' | 'aborted' | 'not_found' | 'forbidden' | 'bad_request'
  | 'server' | 'not_registered' | 'invalid_result' | 'unknown';

export class DataError extends Error {
  override name = 'DataError';
  constructor(
    public readonly code: DataErrorCode,
    message: string,
    public readonly options: { status?: number; source?: string; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message);
  }
  get status(): number | undefined {
    return this.options.status;
  }
  get source(): string | undefined {
    return this.options.source;
  }
  get retryable(): boolean {
    return this.options.retryable ?? (this.code === 'network' || this.code === 'timeout' || this.code === 'server');
  }
}

/** Values the blocks can reference with `@route.slug`, `{{query.page}}`, `{{page.site.title}}` … */
export interface DataContext {
  route?: Record<string, string | undefined>;
  query?: Record<string, string | string[] | undefined>;
  /** page-level scalar values (e.g. `{ site: { title: 'My shop' } }`) */
  page?: Record<string, unknown>;
  global?: Record<string, unknown>;
  locale?: string;
  /** a `single` record was not found → the host should answer HTTP 404 on the server */
  onNotFound?: (info: { source: string; itemId?: string }) => void;
  /** pagers navigate by changing the query string (SSR friendly + crawlable) */
  navigate?: (query: Record<string, string | null>) => void;
}

export interface FetchContext {
  signal: AbortSignal;
  context?: DataContext;
}

export type FetchResult = DataResult | DataRow[] | PromiseLike<DataResult | DataRow[]> | ObservableLike<DataResult | DataRow[]>;

/** Anything with `subscribe` (an rxjs Observable) — the core has no rxjs dependency. */
export interface ObservableLike<T> {
  subscribe(observer: { next?: (v: T) => void; error?: (e: unknown) => void; complete?: () => void } | ((v: T) => void)): { unsubscribe(): void } | void;
}

export interface DataSourceDefinition {
  id: string;
  label?: string;
  /** `record` sources return a single row (details pages). Default `collection`. */
  kind?: 'collection' | 'record';
  fields?: FieldDefinition[];
  params?: ParamDefinition[];
  pagination?: { defaultTake?: number; maxTake?: number };
  cache?: {
    /** how long a result is fresh (ms). Default: store default (0 = no client cache) */
    ttlMs?: number;
    /** after ttl, serve the stale result immediately and refresh in the background (ms) */
    staleMs?: number;
    /** `store.invalidate({ tag })` drops every entry carrying the tag */
    tags?: string[];
  };
  /** fetch one request. Prefer `batch` for HTTP so many blocks cost ONE round trip. */
  fetch?: (request: NormalizedRequest, ctx: FetchContext) => FetchResult;
  /** sources sharing the same group id are sent together through the group's batch fetcher */
  batch?: string;
  /** design-time / demo rows */
  rows?: DataRow[];
}

export interface DataSchema {
  id: string;
  label?: string;
  kind: 'collection' | 'record';
  fields: FieldDefinition[];
  params: ParamDefinition[];
  pagination: { defaultTake?: number; maxTake?: number };
}

export interface BatchItem {
  /** unique inside one batch call (the server echoes it back) */
  id: string;
  request: NormalizedRequest;
}

export type BatchOutcome = DataResult | { error: { code?: string; message?: string; status?: number } };
export type BatchFetcher = (items: BatchItem[], ctx: FetchContext) => Promise<Record<string, BatchOutcome>>;

/** A request together with its result, for priming (SSR) and for exporting state. */
export interface PrimeEntry {
  request: DataRequest;
  result: DataResult;
}
