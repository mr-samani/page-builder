import { normalizeRequest, requestKey } from './request';
import {
  DataError,
  type BatchFetcher,
  type DataContext,
  type DataErrorCode,
  type DataRequest,
  type DataResult,
  type DataSchema,
  type DataSourceDefinition,
  type NormalizedRequest,
  type ObservableLike,
  type PrimeEntry,
} from './types';

export interface StoreOptions {
  /** how long results stay fresh when the source does not say (ms). 0 = no client cache (in-flight requests are still shared) */
  defaultTtlMs?: number;
  maxEntries?: number;
  /** parallel NON-batched fetches */
  maxConcurrent?: number;
  /** requests issued within this window travel together. 0 = same tick (microtask) */
  batchWindowMs?: number;
  /** requests per batch call */
  maxBatchSize?: number;
  /** per attempt; 0 disables */
  timeoutMs?: number;
  /** retries for retryable errors (network / timeout / 5xx) */
  retries?: number;
  retryDelayMs?: number;
  /** how long server-primed (SSR) results are served before the client may refetch */
  primeTtlMs?: number;
  now?: () => number;
  onEvent?: (e: StoreEvent) => void;
}

export type StoreEvent =
  | { type: 'hit' | 'stale' | 'join' | 'miss' | 'prime' | 'evict' | 'retry' | 'abort'; key: string; source: string }
  | { type: 'fetch'; key: string; source: string; ms: number; batched: boolean }
  | { type: 'batch'; group: string; size: number; ms: number }
  | { type: 'error'; key: string; source: string; error: DataError };

export interface StoreStats {
  hits: number;
  staleHits: number;
  misses: number;
  joins: number;
  fetches: number;
  batches: number;
  batchedRequests: number;
  retries: number;
  errors: number;
  aborted: number;
  evictions: number;
  primed: number;
  entries: number;
  inflight: number;
}

export interface LoadOptions {
  signal?: AbortSignal;
  /** bypass the cache (still joins an identical in-flight request) */
  force?: boolean;
}

interface Entry {
  key: string;
  source: string;
  result: DataResult;
  at: number;
  ttl: number;
  stale: number;
  tags: readonly string[];
}

interface Subscriber {
  signal?: AbortSignal;
  reject: (e: unknown) => void;
}

interface Flight {
  key: string;
  request: NormalizedRequest;
  def: DataSourceDefinition | undefined;
  controller: AbortController;
  subscribers: Set<Subscriber>;
  started: boolean;
  settled: boolean;
  promise: Promise<DataResult>;
  resolve: (r: DataResult) => void;
  reject: (e: unknown) => void;
  /** background revalidation: nobody awaits it */
  silent: boolean;
}

const DEFAULTS: Required<Omit<StoreOptions, 'now' | 'onEvent'>> = {
  defaultTtlMs: 0,
  maxEntries: 500,
  maxConcurrent: 6,
  batchWindowMs: 0,
  maxBatchSize: 50,
  timeoutMs: 15_000,
  retries: 1,
  retryDelayMs: 150,
  primeTtlMs: 60_000,
};

const DEFAULT_GROUP = '*';

export class DataStore {
  readonly options: Required<Omit<StoreOptions, 'now' | 'onEvent'>> & Pick<StoreOptions, 'now' | 'onEvent'>;
  /** passed to every fetcher (tenant, locale, auth …) */
  context: DataContext = {};

  private readonly defs = new Map<string, DataSourceDefinition>();
  private readonly batchFetchers = new Map<string, BatchFetcher>();
  private readonly entries = new Map<string, Entry>();
  private readonly inflight = new Map<string, Flight>();
  private queue: Flight[] = [];
  private flushScheduled = false;
  private active = 0;
  private readonly waiting: (() => void)[] = [];
  private readonly listeners = new Set<(info: { source: string; key: string }) => void>();
  private schemaProvider?: (source: string) => Promise<DataSchema | undefined>;
  private readonly schemaCache = new Map<string, Promise<DataSchema | undefined>>();
  private disposed = false;

  private readonly counters: StoreStats = {
    hits: 0, staleHits: 0, misses: 0, joins: 0, fetches: 0, batches: 0, batchedRequests: 0,
    retries: 0, errors: 0, aborted: 0, evictions: 0, primed: 0, entries: 0, inflight: 0,
  };

  constructor(options: StoreOptions = {}) {
    this.options = { ...DEFAULTS, ...stripUndefined(options) };
  }

  //==================================================================================
  // registration
  //==================================================================================

  register(def: DataSourceDefinition | DataSourceDefinition[]): this {
    for (const d of Array.isArray(def) ? def : [def]) {
      if (!d?.id) throw new Error('DataSourceDefinition.id is required');
      this.defs.set(d.id, d);
      this.schemaCache.delete(d.id);
    }
    return this;
  }

  unregister(id: string): void {
    this.defs.delete(id);
    this.schemaCache.delete(id);
  }

  getDefinition(id: string): DataSourceDefinition | undefined {
    return this.defs.get(id);
  }

  listDefinitions(): DataSourceDefinition[] {
    return [...this.defs.values()];
  }

  /**
   * One round trip for many sources: sources whose definition has `batch: '<group>'` are sent together.
   * `'*'` is also the fallback for sources that have no definition at all (the backend knows them).
   */
  setBatchFetcher(group: string | null, fn: BatchFetcher): this {
    this.batchFetchers.set(group ?? DEFAULT_GROUP, fn);
    return this;
  }

  /** where the designer gets field lists from for sources that were not registered locally */
  setSchemaProvider(fn: (source: string) => Promise<DataSchema | undefined>): this {
    this.schemaProvider = fn;
    this.schemaCache.clear();
    return this;
  }

  /** Field / param / paging description of a source — NO data is fetched. */
  describe(source: string): DataSchema | undefined {
    const d = this.defs.get(source);
    return d && toSchema(d);
  }

  describeAsync(source: string): Promise<DataSchema | undefined> {
    const local = this.describe(source);
    if (local && (local.fields.length || !this.schemaProvider)) return Promise.resolve(local);
    if (!this.schemaProvider) return Promise.resolve(undefined);
    let p = this.schemaCache.get(source);
    if (!p) {
      p = this.schemaProvider(source).catch(() => undefined);
      this.schemaCache.set(source, p);
    }
    return p;
  }

  //==================================================================================
  // loading
  //==================================================================================

  /** Normalizes the request, answers from cache, joins an identical in-flight request, or schedules a (batched) fetch. */
  load(request: DataRequest, opts: LoadOptions = {}): Promise<DataResult> {
    if (this.disposed) return Promise.reject(new DataError('aborted', 'The data store was disposed.', { source: request.source }));
    if (opts.signal?.aborted) return Promise.reject(abortError(request.source));

    const def = this.defs.get(request.source);
    const n = normalizeRequest(request, def);
    const key = requestKey(n);

    if (!opts.force) {
      const e = this.entries.get(key);
      if (e) {
        const age = this.now() - e.at;
        if (age < e.ttl) {
          this.touch(e);
          this.counters.hits++;
          this.emit({ type: 'hit', key, source: n.source });
          return Promise.resolve(e.result);
        }
        if (age < e.ttl + e.stale) {
          // stale-while-revalidate: answer now, refresh quietly
          this.touch(e);
          this.counters.staleHits++;
          this.emit({ type: 'stale', key, source: n.source });
          if (!this.inflight.has(key)) this.startFlight(key, n, def, true);
          return Promise.resolve(e.result);
        }
        this.entries.delete(key);
      }
    }

    return this.subscribe(this.inflight.get(key) ?? this.startFlight(key, n, def, false), opts.signal, n.source);
  }

  /** Several requests at once (they naturally travel in one batch). Never rejects: each outcome is reported. */
  loadMany(requests: DataRequest[], opts: LoadOptions = {}): Promise<PromiseSettledResult<DataResult>[]> {
    return Promise.allSettled(requests.map((r) => this.load(r, opts)));
  }

  /** Warm the cache without caring about the result (e.g. before the DOM exists). Errors are swallowed. */
  prefetch(requests: DataRequest[]): Promise<void> {
    return this.loadMany(requests).then(() => undefined);
  }

  /** Synchronous cache read (fresh or stale). */
  peek(request: DataRequest): DataResult | undefined {
    const n = normalizeRequest(request, this.defs.get(request.source));
    const e = this.entries.get(requestKey(n));
    if (!e) return undefined;
    return this.now() - e.at < e.ttl + e.stale ? e.result : undefined;
  }

  //==================================================================================
  // cache management / SSR
  //==================================================================================

  /** Results computed by the server (the render endpoint ships them with the page) — the client never asks again. */
  prime(entries: PrimeEntry[]): void {
    for (const p of entries ?? []) {
      if (!p?.request?.source || !p.result) continue;
      let result: DataResult;
      try {
        result = normalizeResult(p.result, p.request.source);
      } catch {
        continue;
      }
      const def = this.defs.get(p.request.source);
      const n = normalizeRequest(p.request, def);
      const key = requestKey(n);
      this.store({ key, source: n.source, result, at: this.now(), ttl: Math.max(this.options.primeTtlMs, this.ttlOf(def)), stale: def?.cache?.staleMs ?? 0, tags: def?.cache?.tags ?? [] });
      this.counters.primed++;
      this.emit({ type: 'prime', key, source: n.source });
    }
  }

  /** Fresh entries in a JSON-safe form (put them in TransferState / the page payload). */
  exportState(filter?: { source?: string }): PrimeEntry[] {
    const out: PrimeEntry[] = [];
    const now = this.now();
    for (const e of this.entries.values()) {
      if (filter?.source && e.source !== filter.source) continue;
      if (now - e.at >= e.ttl + e.stale) continue;
      out.push({ request: JSON.parse(e.key) as DataRequest, result: e.result });
    }
    return out;
  }

  invalidate(filter: { source?: string; tag?: string; key?: string } | 'all' = 'all'): number {
    let n = 0;
    for (const [key, e] of this.entries) {
      const hit =
        filter === 'all' ||
        (filter.key !== undefined && e.key === filter.key) ||
        (filter.source !== undefined && e.source === filter.source) ||
        (filter.tag !== undefined && e.tags.includes(filter.tag));
      if (hit) {
        this.entries.delete(key);
        n++;
      }
    }
    return n;
  }

  /** Called when a background refresh (stale-while-revalidate) delivers new data. */
  onChange(cb: (info: { source: string; key: string }) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  stats(): StoreStats {
    return { ...this.counters, entries: this.entries.size, inflight: this.inflight.size };
  }

  dispose(): void {
    this.disposed = true;
    for (const f of [...this.inflight.values()]) f.controller.abort();
    this.inflight.clear();
    this.entries.clear();
    this.queue = [];
    this.listeners.clear();
  }

  //==================================================================================
  // flights
  //==================================================================================

  private startFlight(key: string, request: NormalizedRequest, def: DataSourceDefinition | undefined, silent: boolean): Flight {
    let resolve!: (r: DataResult) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<DataResult>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    promise.catch(() => undefined); // nobody may be listening (all subscribers aborted) — never an unhandled rejection

    const flight: Flight = { key, request, def, controller: new AbortController(), subscribers: new Set(), started: false, settled: false, promise, resolve, reject, silent };
    this.inflight.set(key, flight);
    this.counters.misses++;
    this.emit({ type: 'miss', key, source: request.source });
    this.queue.push(flight);
    this.scheduleFlush();
    return flight;
  }

  private subscribe(flight: Flight, signal: AbortSignal | undefined, source: string): Promise<DataResult> {
    if (flight.subscribers.size > 0 || flight.started) {
      this.counters.joins++;
      this.emit({ type: 'join', key: flight.key, source });
    }
    flight.silent = false;
    return new Promise<DataResult>((resolve, reject) => {
      const sub: Subscriber = { signal, reject };
      flight.subscribers.add(sub);

      const onAbort = () => {
        if (!flight.subscribers.delete(sub)) return;
        this.counters.aborted++;
        this.emit({ type: 'abort', key: flight.key, source });
        reject(abortError(source));
        // nobody wants it any more → cancel the network work (or drop it from the queue)
        if (flight.subscribers.size === 0 && !flight.settled && !flight.silent) flight.controller.abort();
      };
      signal?.addEventListener('abort', onAbort, { once: true });

      flight.promise.then(
        (r) => {
          signal?.removeEventListener('abort', onAbort);
          if (flight.subscribers.delete(sub)) resolve(r);
        },
        (e) => {
          signal?.removeEventListener('abort', onAbort);
          if (flight.subscribers.delete(sub)) reject(e);
        },
      );
    });
  }

  private scheduleFlush(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    const run = () => {
      this.flushScheduled = false;
      this.flush();
    };
    if (this.options.batchWindowMs > 0) setTimeout(run, this.options.batchWindowMs);
    else queueMicrotask(run);
  }

  private flush(): void {
    const queued = this.queue;
    this.queue = [];
    const groups = new Map<string, Flight[]>();
    const singles: Flight[] = [];

    for (const f of queued) {
      if (f.controller.signal.aborted) {
        this.settle(f, undefined, abortError(f.request.source));
        continue;
      }
      if (f.def?.fetch || f.def?.rows) {
        singles.push(f);
        continue;
      }
      const group = f.def?.batch ?? DEFAULT_GROUP;
      if (this.batchFetchers.has(group)) {
        let list = groups.get(group);
        if (!list) groups.set(group, (list = []));
        list.push(f);
      } else if (this.batchFetchers.has(DEFAULT_GROUP) && !f.def?.batch) {
        let list = groups.get(DEFAULT_GROUP);
        if (!list) groups.set(DEFAULT_GROUP, (list = []));
        list.push(f);
      } else {
        this.settle(f, undefined, new DataError('not_registered', `No data source "${f.request.source}" is registered and no batch fetcher is available.`, { source: f.request.source }));
      }
    }

    for (const [group, flights] of groups) {
      for (let i = 0; i < flights.length; i += this.options.maxBatchSize) {
        void this.runBatch(group, flights.slice(i, i + this.options.maxBatchSize));
      }
    }
    for (const f of singles) void this.runSingle(f);
  }

  //==================================================================================
  // execution
  //==================================================================================

  private async runBatch(group: string, flights: Flight[]): Promise<void> {
    const fetcher = this.batchFetchers.get(group)!;
    const started = this.now();
    for (const f of flights) f.started = true;
    this.counters.batches++;
    this.counters.batchedRequests += flights.length;

    // the shared call is cancelled only when EVERY request inside it was cancelled
    const chunk = new AbortController();
    const live = new Set(flights);
    const watchers = flights.map((f) => {
      const on = () => {
        live.delete(f);
        if (live.size === 0) chunk.abort();
      };
      f.controller.signal.addEventListener('abort', on, { once: true });
      return () => f.controller.signal.removeEventListener('abort', on);
    });

    const items = flights.map((f, i) => ({ id: String(i), request: f.request }));
    try {
      const outcomes = await this.attempt((signal) => fetcher(items, { signal, context: this.context }), chunk.signal, flights[0].request.source);
      this.emit({ type: 'batch', group, size: flights.length, ms: this.now() - started });
      flights.forEach((f, i) => {
        const out = outcomes?.[String(i)];
        if (!out) return this.settle(f, undefined, new DataError('invalid_result', `The batch response has no result for "${f.request.source}".`, { source: f.request.source }));
        if ('error' in out && out.error) return this.settle(f, undefined, errorFromOutcome(out.error, f.request.source));
        try {
          this.settle(f, normalizeResult(out as DataResult, f.request.source), undefined, this.now() - started, true);
        } catch (e) {
          this.settle(f, undefined, toDataError(e, f.request.source));
        }
      });
    } catch (e) {
      for (const f of flights) this.settle(f, undefined, toDataError(e, f.request.source));
    } finally {
      watchers.forEach((w) => w());
    }
  }

  private async runSingle(f: Flight): Promise<void> {
    await this.acquire();
    if (f.controller.signal.aborted) {
      this.release();
      return this.settle(f, undefined, abortError(f.request.source));
    }
    f.started = true;
    const started = this.now();
    try {
      const def = f.def!;
      let raw: DataResult | DataResult['items'];
      if (def.fetch) {
        raw = await this.attempt((signal) => toPromise(def.fetch!(f.request, { signal, context: this.context })), f.controller.signal, f.request.source);
      } else {
        raw = sliceRows(def.rows ?? [], f.request);
      }
      this.settle(f, normalizeResult(raw, f.request.source), undefined, this.now() - started, false);
    } catch (e) {
      this.settle(f, undefined, toDataError(e, f.request.source));
    } finally {
      this.release();
    }
  }

  private settle(f: Flight, result?: DataResult, error?: DataError, ms = 0, batched = false): void {
    if (f.settled) return;
    f.settled = true;
    if (this.inflight.get(f.key) === f) this.inflight.delete(f.key);

    if (error) {
      if (error.code !== 'aborted') {
        this.counters.errors++;
        this.emit({ type: 'error', key: f.key, source: f.request.source, error });
      }
      f.reject(error);
      return;
    }

    this.counters.fetches++;
    this.emit({ type: 'fetch', key: f.key, source: f.request.source, ms, batched });
    const ttl = this.ttlOf(f.def);
    const stale = f.def?.cache?.staleMs ?? 0;
    if (ttl > 0) this.store({ key: f.key, source: f.request.source, result: result!, at: this.now(), ttl, stale, tags: f.def?.cache?.tags ?? [] });
    f.resolve(result!);
    if (f.silent) for (const l of this.listeners) l({ source: f.request.source, key: f.key });
  }

  /** timeout + retry around one network attempt. Fetchers that ignore the AbortSignal still stop being awaited. */
  private async attempt<T>(run: (signal: AbortSignal) => Promise<T>, outer: AbortSignal, source: string): Promise<T> {
    let tries = 0;
    for (;;) {
      if (outer.aborted) throw abortError(source);
      const ctl = new AbortController();
      const onOuter = () => ctl.abort();
      outer.addEventListener('abort', onOuter, { once: true });
      let timer: ReturnType<typeof setTimeout> | undefined;
      let timedOut = false;
      if (this.options.timeoutMs > 0) {
        timer = setTimeout(() => {
          timedOut = true;
          ctl.abort();
        }, this.options.timeoutMs);
      }
      try {
        return await raceAbort(run(ctl.signal), ctl.signal);
      } catch (e) {
        if (outer.aborted) throw abortError(source);
        const err = timedOut ? new DataError('timeout', `"${source}" timed out after ${this.options.timeoutMs} ms.`, { source }) : toDataError(e, source);
        if (!err.retryable || tries >= this.options.retries) throw err;
        tries++;
        this.counters.retries++;
        this.emit({ type: 'retry', key: '', source });
        await sleep(this.options.retryDelayMs * 2 ** (tries - 1), outer);
      } finally {
        if (timer) clearTimeout(timer);
        outer.removeEventListener('abort', onOuter);
      }
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.options.maxConcurrent) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise((res) => this.waiting.push(() => { this.active++; res(); }));
  }

  private release(): void {
    this.active--;
    this.waiting.shift()?.();
  }

  //==================================================================================
  // cache internals
  //==================================================================================

  private ttlOf(def?: DataSourceDefinition): number {
    return def?.cache?.ttlMs ?? this.options.defaultTtlMs;
  }

  private store(e: Entry): void {
    this.entries.delete(e.key);
    this.entries.set(e.key, e);
    while (this.entries.size > this.options.maxEntries) {
      const oldest = this.entries.keys().next().value as string;
      this.entries.delete(oldest);
      this.counters.evictions++;
      this.emit({ type: 'evict', key: oldest, source: e.source });
    }
  }

  private touch(e: Entry): void {
    this.entries.delete(e.key);
    this.entries.set(e.key, e);
  }

  private now(): number {
    return this.options.now ? this.options.now() : Date.now();
  }

  private emit(e: StoreEvent): void {
    this.options.onEvent?.(e);
  }
}

//==================================================================================
// helpers
//==================================================================================

function stripUndefined<T extends object>(o: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(o) as (keyof T)[]) if (o[k] !== undefined) out[k] = o[k];
  return out;
}

export function toSchema(d: DataSourceDefinition): DataSchema {
  return { id: d.id, label: d.label, kind: d.kind ?? 'collection', fields: d.fields ?? [], params: d.params ?? [], pagination: d.pagination ?? {} };
}

const abortError = (source: string) => new DataError('aborted', 'The request was cancelled.', { source, retryable: false });

/** Accepts `{items,total}`, a bare array, … and rejects anything else loudly (a silent empty list hides backend bugs). */
export function normalizeResult(raw: unknown, source: string): DataResult {
  if (Array.isArray(raw)) return { items: raw as DataResult['items'] };
  if (raw && typeof raw === 'object' && Array.isArray((raw as DataResult).items)) {
    const r = raw as DataResult;
    const out: DataResult = { items: r.items };
    if (typeof r.total === 'number' && Number.isFinite(r.total) && r.total >= 0) out.total = Math.trunc(r.total);
    if (r.nextCursor !== undefined) out.nextCursor = r.nextCursor;
    if (r.meta) out.meta = r.meta;
    return out;
  }
  throw new DataError('invalid_result', `Data source "${source}" must return an array or { items: [...] }.`, { source, retryable: false });
}

/** Static rows: skip / take applied here (design-time data and tests). */
function sliceRows(rows: DataResult['items'], r: NormalizedRequest): DataResult {
  const total = rows.length;
  const end = r.take === null ? undefined : r.skip + r.take;
  return { items: rows.slice(r.skip, end), total };
}

function toPromise<T>(v: T | PromiseLike<T> | ObservableLike<T>): Promise<T> {
  if (v && typeof (v as ObservableLike<T>).subscribe === 'function') {
    return new Promise<T>((resolve, reject) => {
      let done = false;
      let sub: { unsubscribe?: () => void } | void = undefined;
      const stop = () => {
        // the observable may emit synchronously, before subscribe() returned its subscription
        if (sub && typeof sub.unsubscribe === 'function') sub.unsubscribe();
      };
      sub = (v as ObservableLike<T>).subscribe({
        next: (x) => {
          if (done) return;
          done = true;
          resolve(x);
          stop();
        },
        error: (e) => {
          done = true;
          reject(e);
        },
        complete: () => {
          if (!done) reject(new DataError('invalid_result', 'The observable completed without a value.'));
        },
      });
      if (done) stop();
    });
  }
  return Promise.resolve(v as T | PromiseLike<T>);
}

function raceAbort<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    p.catch(() => undefined);
    return Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
  }
  return new Promise<T>((resolve, reject) => {
    const on = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    signal.addEventListener('abort', on, { once: true });
    p.then(
      (v) => {
        signal.removeEventListener('abort', on);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener('abort', on);
        reject(e);
      },
    );
  });
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(done, ms);
    function done() {
      signal.removeEventListener('abort', done);
      clearTimeout(t);
      resolve();
    }
    signal.addEventListener('abort', done, { once: true });
  });
}

function codeFromStatus(status: number): DataErrorCode {
  if (status === 400 || status === 422) return 'bad_request';
  if (status === 401 || status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 408 || status === 429 || status >= 500) return 'server';
  return 'unknown';
}

function errorFromOutcome(e: { code?: string; message?: string; status?: number }, source: string): DataError {
  const code = (e.code as DataErrorCode | undefined) ?? (e.status ? codeFromStatus(e.status) : 'unknown');
  return new DataError(code, e.message ?? `Data source "${source}" failed.`, { status: e.status, source });
}

export function toDataError(e: unknown, source: string): DataError {
  if (e instanceof DataError) return e;
  const err = e as { name?: string; status?: number; message?: string } | undefined;
  if (err?.name === 'AbortError') return abortError(source);
  if (typeof err?.status === 'number') return new DataError(codeFromStatus(err.status), err.message ?? `HTTP ${err.status}`, { status: err.status, source, cause: e });
  if (e instanceof TypeError) return new DataError('network', err?.message ?? 'Network error', { source, cause: e });
  return new DataError('unknown', err?.message ?? String(e), { source, retryable: false, cause: e });
}
