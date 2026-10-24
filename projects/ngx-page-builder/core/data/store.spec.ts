import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataStore, normalizeResult, toDataError } from './store';
import { DataError, type BatchFetcher, type NormalizedRequest } from './types';

const rows = (n: number, from = 0) => Array.from({ length: n }, (_, i) => ({ id: from + i, title: `P${from + i}` }));
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe('DataStore — basics', () => {
  it('loads through a registered fetch and normalizes arrays', async () => {
    const store = new DataStore();
    store.register({ id: 'p', fetch: () => rows(3) });
    const r = await store.load({ source: 'p' });
    expect(r.items).toHaveLength(3);
    expect(r.total).toBeUndefined();
  });

  it('passes the NORMALIZED request and the store context to the fetcher', async () => {
    const store = new DataStore();
    store.context = { global: { tenant: 't1' } };
    const fetch = vi.fn((req: NormalizedRequest, ctx) => ({ items: [], total: ctx.context?.global?.['tenant'] ? 1 : 0, meta: { req } }));
    store.register({ id: 'p', pagination: { defaultTake: 12 }, fetch });
    const r = await store.load({ source: 'p', params: { b: 2, a: '' } });
    const req = (r.meta as { req: NormalizedRequest }).req;
    expect(req).toMatchObject({ source: 'p', skip: 0, take: 12, params: { b: 2 }, mode: 'list' });
    expect(r.total).toBe(1);
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('rejects invalid results loudly (a silent empty list hides backend bugs)', async () => {
    const store = new DataStore();
    store.register({ id: 'p', fetch: () => ({ nope: true }) as never });
    await expect(store.load({ source: 'p' })).rejects.toMatchObject({ code: 'invalid_result' });
    expect(() => normalizeResult('x', 's')).toThrow(DataError);
    expect(normalizeResult({ items: [], total: -1 }, 's').total).toBeUndefined();
    expect(normalizeResult({ items: [], total: 4.9 }, 's').total).toBe(4);
  });

  it('rejects unknown sources with not_registered when there is no batch fetcher', async () => {
    const store = new DataStore();
    await expect(store.load({ source: 'ghost' })).rejects.toMatchObject({ code: 'not_registered', source: 'ghost' });
  });

  it('supports static rows with skip/take/total (design time + tests)', async () => {
    const store = new DataStore();
    store.register({ id: 'p', rows: rows(10) });
    const r = await store.load({ source: 'p', skip: 3, take: 4 });
    expect(r.items.map((x) => x['id'])).toEqual([3, 4, 5, 6]);
    expect(r.total).toBe(10);
  });

  it('accepts an Observable-like (first value) without depending on rxjs', async () => {
    const store = new DataStore();
    const unsub = vi.fn();
    store.register({
      id: 'p',
      fetch: () => ({
        subscribe: (o: { next: (v: unknown) => void }) => {
          o.next({ items: rows(2) });
          o.next({ items: rows(5) }); // later emissions are ignored
          return { unsubscribe: unsub };
        },
      }) as never,
    });
    expect((await store.load({ source: 'p' })).items).toHaveLength(2);
    expect(unsub).toHaveBeenCalled();
  });

  it('rejects when an Observable errors or completes empty', async () => {
    const store = new DataStore({ retries: 0 });
    store.register({ id: 'e', fetch: () => ({ subscribe: (o: { error: (e: unknown) => void }) => { o.error(new Error('boom')); } }) as never });
    store.register({ id: 'c', fetch: () => ({ subscribe: (o: { complete: () => void }) => { o.complete(); } }) as never });
    await expect(store.load({ source: 'e' })).rejects.toThrow('boom');
    await expect(store.load({ source: 'c' })).rejects.toMatchObject({ code: 'invalid_result' });
  });

  it('describe() returns the schema WITHOUT fetching', () => {
    const store = new DataStore();
    const fetch = vi.fn();
    store.register({ id: 'p', label: 'Products', kind: 'collection', fields: [{ name: 'title', type: 'string' }], params: [{ name: 'q' }], fetch });
    expect(store.describe('p')).toEqual({ id: 'p', label: 'Products', kind: 'collection', fields: [{ name: 'title', type: 'string' }], params: [{ name: 'q' }], pagination: {} });
    expect(store.describe('nope')).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('describeAsync() asks the schema provider once and caches it', async () => {
    const store = new DataStore();
    const provider = vi.fn(async (id: string) => ({ id, kind: 'collection' as const, fields: [{ name: 'x' }], params: [], pagination: {} }));
    store.setSchemaProvider(provider);
    const [a, b] = await Promise.all([store.describeAsync('remote'), store.describeAsync('remote')]);
    expect(a?.fields).toEqual([{ name: 'x' }]);
    expect(b).toBe(a);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('register validates ids; unregister removes', () => {
    const store = new DataStore();
    expect(() => store.register({ id: '' } as never)).toThrow();
    store.register({ id: 'a', rows: [] });
    expect(store.getDefinition('a')).toBeDefined();
    expect(store.listDefinitions()).toHaveLength(1);
    store.unregister('a');
    expect(store.getDefinition('a')).toBeUndefined();
  });
});

describe('DataStore — dedupe and cache', () => {
  it('shares ONE fetch between identical concurrent requests (any param order)', async () => {
    const store = new DataStore();
    const fetch = vi.fn(async () => ({ items: rows(2) }));
    store.register({ id: 'p', fetch });
    const [a, b, c] = await Promise.all([
      store.load({ source: 'p', params: { a: 1, b: 2 } }),
      store.load({ source: 'p', params: { b: 2, a: 1 } }),
      store.load({ source: 'p', params: { a: 1, b: 2, c: '' } }),
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(store.stats().joins).toBe(2);
  });

  it('does not share requests that differ', async () => {
    const store = new DataStore();
    const fetch = vi.fn(async () => ({ items: [] }));
    store.register({ id: 'p', fetch });
    await Promise.all([store.load({ source: 'p', skip: 0 }), store.load({ source: 'p', skip: 10 }), store.load({ source: 'p', search: 'x' })]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('caches for the source ttl and refetches after it (injected clock)', async () => {
    let t = 1000;
    const store = new DataStore({ now: () => t });
    const fetch = vi.fn(async () => ({ items: rows(1) }));
    store.register({ id: 'p', cache: { ttlMs: 500 }, fetch });
    await store.load({ source: 'p' });
    t += 400;
    await store.load({ source: 'p' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(store.stats().hits).toBe(1);
    t += 200;
    await store.load({ source: 'p' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('ttl 0 (default) = no cache but in-flight sharing', async () => {
    const store = new DataStore();
    const fetch = vi.fn(async () => ({ items: [] }));
    store.register({ id: 'p', fetch });
    await store.load({ source: 'p' });
    await store.load({ source: 'p' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('force bypasses the cache', async () => {
    const store = new DataStore({ defaultTtlMs: 10_000 });
    const fetch = vi.fn(async () => ({ items: [] }));
    store.register({ id: 'p', fetch });
    await store.load({ source: 'p' });
    await store.load({ source: 'p' });
    await store.load({ source: 'p' }, { force: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('evicts the least recently used entry beyond maxEntries', async () => {
    const store = new DataStore({ defaultTtlMs: 10_000, maxEntries: 2 });
    store.register({ id: 'p', fetch: async (r) => ({ items: [{ k: r.skip }] }) });
    await store.load({ source: 'p', skip: 1 });
    await store.load({ source: 'p', skip: 2 });
    await store.load({ source: 'p', skip: 1 }); // touch 1 → 2 is now the oldest
    await store.load({ source: 'p', skip: 3 });
    expect(store.peek({ source: 'p', skip: 1 })).toBeDefined();
    expect(store.peek({ source: 'p', skip: 2 })).toBeUndefined();
    expect(store.stats().evictions).toBe(1);
  });

  it('errors are never cached', async () => {
    const store = new DataStore({ defaultTtlMs: 10_000, retries: 0 });
    let n = 0;
    store.register({ id: 'p', fetch: async () => { if (n++ === 0) throw new TypeError('offline'); return { items: rows(1) }; } });
    await expect(store.load({ source: 'p' })).rejects.toMatchObject({ code: 'network' });
    expect((await store.load({ source: 'p' })).items).toHaveLength(1);
  });

  it('invalidate by source, tag, key and all', async () => {
    const store = new DataStore({ defaultTtlMs: 10_000 });
    store.register([
      { id: 'a', cache: { tags: ['catalog'] }, rows: rows(1) },
      { id: 'b', cache: { tags: ['catalog', 'x'] }, rows: rows(1) },
      { id: 'c', rows: rows(1) },
    ]);
    const load = () => Promise.all(['a', 'b', 'c'].map((s) => store.load({ source: s })));
    await load();
    expect(store.invalidate({ tag: 'catalog' })).toBe(2);
    expect(store.stats().entries).toBe(1);
    await load();
    expect(store.invalidate({ source: 'c' })).toBe(1);
    expect(store.invalidate('all')).toBe(2);
    expect(store.stats().entries).toBe(0);
  });
});

describe('DataStore — batching (one round trip for many blocks)', () => {
  const echo: BatchFetcher = async (items) => Object.fromEntries(items.map((i) => [i.id, { items: [{ source: i.request.source, skip: i.request.skip }], total: 1 }]));

  it('sends every request of the same tick in ONE call and dedupes identical ones', async () => {
    const store = new DataStore();
    const fetcher = vi.fn(echo);
    store.setBatchFetcher('api', fetcher);
    store.register([{ id: 'products', batch: 'api' }, { id: 'cats', batch: 'api' }]);
    const results = await Promise.all([
      store.load({ source: 'products', take: 8 }),
      store.load({ source: 'cats' }),
      store.load({ source: 'products', take: 8 }), // identical → joined
      store.load({ source: 'products', take: 8, skip: 8 }),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0].map((i) => i.request.source).sort()).toEqual(['cats', 'products', 'products']);
    expect(results[0]).toBe(results[2]);
    expect(results[3].items[0]).toMatchObject({ source: 'products', skip: 8 });
    const s = store.stats();
    expect(s.batches).toBe(1);
    expect(s.batchedRequests).toBe(3);
  });

  it('the default group "*" serves sources that are not registered locally', async () => {
    const store = new DataStore();
    const fetcher = vi.fn(echo);
    store.setBatchFetcher(null, fetcher);
    const r = await store.load({ source: 'anything' });
    expect(r.items[0]).toMatchObject({ source: 'anything' });
  });

  it('splits into chunks of maxBatchSize', async () => {
    const store = new DataStore({ maxBatchSize: 3 });
    const fetcher = vi.fn(echo);
    store.setBatchFetcher(null, fetcher);
    await Promise.all(Array.from({ length: 7 }, (_, i) => store.load({ source: 's', skip: i })));
    expect(fetcher.mock.calls.map((c) => c[0].length)).toEqual([3, 3, 1]);
  });

  it('a per-item error fails only that request', async () => {
    const store = new DataStore();
    store.setBatchFetcher(null, async (items) => ({
      [items[0].id]: { items: rows(1) },
      [items[1].id]: { error: { code: 'not_found', message: 'no such product', status: 404 } },
    }));
    const [ok, bad] = await Promise.allSettled([store.load({ source: 'a' }), store.load({ source: 'b' })]);
    expect(ok.status).toBe('fulfilled');
    expect(bad).toMatchObject({ status: 'rejected', reason: { code: 'not_found', status: 404, message: 'no such product' } });
  });

  it('maps an error outcome with only a status', async () => {
    const store = new DataStore();
    store.setBatchFetcher(null, async (items) => ({ [items[0].id]: { error: { status: 403 } } }));
    await expect(store.load({ source: 'a' })).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('a missing id in the response is an invalid_result for that request only', async () => {
    const store = new DataStore();
    store.setBatchFetcher(null, async (items) => ({ [items[0].id]: { items: [] } }));
    const [a, b] = await Promise.allSettled([store.load({ source: 'a' }), store.load({ source: 'b' })]);
    expect(a.status).toBe('fulfilled');
    expect(b).toMatchObject({ status: 'rejected', reason: { code: 'invalid_result' } });
  });

  it('a transport failure fails (and retries) the whole batch', async () => {
    const store = new DataStore({ retryDelayMs: 1 });
    let n = 0;
    store.setBatchFetcher(null, async (items) => {
      if (n++ === 0) throw new TypeError('Failed to fetch');
      return Object.fromEntries(items.map((i) => [i.id, { items: [] }]));
    });
    await Promise.all([store.load({ source: 'a' }), store.load({ source: 'b' })]);
    expect(n).toBe(2);
    expect(store.stats().retries).toBe(1);
  });

  it('batchWindowMs gathers requests issued over several ticks', async () => {
    vi.useFakeTimers();
    try {
      const store = new DataStore({ batchWindowMs: 20 });
      const fetcher = vi.fn(echo);
      store.setBatchFetcher(null, fetcher);
      const a = store.load({ source: 'a' });
      await vi.advanceTimersByTimeAsync(10);
      const b = store.load({ source: 'b' });
      await vi.advanceTimersByTimeAsync(30);
      await Promise.all([a, b]);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(fetcher.mock.calls[0][0]).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('sources with an own fetch bypass the batch fetcher', async () => {
    const store = new DataStore();
    const batch = vi.fn(echo);
    const own = vi.fn(async () => ({ items: rows(1) }));
    store.setBatchFetcher(null, batch);
    store.register({ id: 'special', fetch: own });
    await Promise.all([store.load({ source: 'special' }), store.load({ source: 'other' })]);
    expect(own).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0][0].map((i) => i.request.source)).toEqual(['other']);
  });
});

describe('DataStore — cancellation', () => {
  it('an already aborted signal rejects immediately without fetching', async () => {
    const store = new DataStore();
    const fetch = vi.fn(async () => ({ items: [] }));
    store.register({ id: 'p', fetch });
    const ac = new AbortController();
    ac.abort();
    await expect(store.load({ source: 'p' }, { signal: ac.signal })).rejects.toMatchObject({ code: 'aborted' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('aborting a request that is still queued never calls the fetcher', async () => {
    const store = new DataStore();
    const fetch = vi.fn(async () => ({ items: [] }));
    store.register({ id: 'p', fetch });
    const ac = new AbortController();
    const p = store.load({ source: 'p' }, { signal: ac.signal });
    ac.abort(); // before the microtask flush
    await expect(p).rejects.toMatchObject({ code: 'aborted' });
    await flush();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('one subscriber aborting does not cancel the shared request for the others', async () => {
    const store = new DataStore();
    let signal!: AbortSignal;
    store.register({ id: 'p', fetch: (_r, c) => { signal = c.signal; return new Promise((res) => setTimeout(() => res({ items: rows(1) }), 10)); } });
    const ac = new AbortController();
    const a = store.load({ source: 'p' }, { signal: ac.signal });
    const b = store.load({ source: 'p' });
    await flush();
    ac.abort();
    await expect(a).rejects.toMatchObject({ code: 'aborted' });
    expect((await b).items).toHaveLength(1);
    expect(signal.aborted).toBe(false);
  });

  it('when EVERY subscriber aborts, the underlying request is cancelled', async () => {
    const store = new DataStore();
    let signal!: AbortSignal;
    store.register({ id: 'p', fetch: (_r, c) => { signal = c.signal; return new Promise(() => undefined); } });
    const a1 = new AbortController();
    const a2 = new AbortController();
    const p1 = store.load({ source: 'p' }, { signal: a1.signal });
    const p2 = store.load({ source: 'p' }, { signal: a2.signal });
    await flush();
    a1.abort();
    a2.abort();
    await expect(p1).rejects.toMatchObject({ code: 'aborted' });
    await expect(p2).rejects.toMatchObject({ code: 'aborted' });
    expect(signal.aborted).toBe(true);
    expect(store.stats().inflight).toBe(0);
  });

  it('a shared batch is cancelled only when all of its requests were', async () => {
    const store = new DataStore();
    let signal!: AbortSignal;
    store.setBatchFetcher(null, (_items, c) => { signal = c.signal; return new Promise(() => undefined); });
    const a1 = new AbortController();
    const a2 = new AbortController();
    const p1 = store.load({ source: 'a' }, { signal: a1.signal });
    const p2 = store.load({ source: 'b' }, { signal: a2.signal });
    await flush();
    a1.abort();
    await expect(p1).rejects.toMatchObject({ code: 'aborted' });
    expect(signal.aborted).toBe(false);
    a2.abort();
    await expect(p2).rejects.toMatchObject({ code: 'aborted' });
    expect(signal.aborted).toBe(true);
  });

  it('dispose() rejects new loads and cancels in-flight ones', async () => {
    const store = new DataStore();
    store.register({ id: 'p', fetch: () => new Promise(() => undefined) });
    const p = store.load({ source: 'p' });
    await flush();
    store.dispose();
    await expect(store.load({ source: 'p' })).rejects.toMatchObject({ code: 'aborted' });
    void p.catch(() => undefined);
  });
});

describe('DataStore — timeout and retry', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('times out a fetcher that never answers (even if it ignores the signal)', async () => {
    const store = new DataStore({ timeoutMs: 100, retries: 0 });
    store.register({ id: 'p', fetch: () => new Promise(() => undefined) });
    const p = store.load({ source: 'p' });
    const assertion = expect(p).rejects.toMatchObject({ code: 'timeout', retryable: true });
    await vi.advanceTimersByTimeAsync(150);
    await assertion;
  });

  it('retries retryable errors with backoff and then succeeds', async () => {
    const store = new DataStore({ retries: 2, retryDelayMs: 100 });
    let n = 0;
    store.register({ id: 'p', fetch: async () => { n++; if (n < 3) throw Object.assign(new Error('bad gateway'), { status: 502 }); return { items: rows(1) }; } });
    const p = store.load({ source: 'p' });
    await vi.advanceTimersByTimeAsync(100); // first backoff
    await vi.advanceTimersByTimeAsync(200); // second backoff (x2)
    expect((await p).items).toHaveLength(1);
    expect(n).toBe(3);
    expect(store.stats().retries).toBe(2);
  });

  it('gives up after the configured retries', async () => {
    const store = new DataStore({ retries: 1, retryDelayMs: 10 });
    let n = 0;
    store.register({ id: 'p', fetch: async () => { n++; throw new TypeError('offline'); } });
    const p = store.load({ source: 'p' });
    const assertion = expect(p).rejects.toMatchObject({ code: 'network' });
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    expect(n).toBe(2);
  });

  it('does not retry 4xx / invalid results', async () => {
    const store = new DataStore({ retries: 3 });
    let n = 0;
    store.register({ id: 'p', fetch: async () => { n++; throw Object.assign(new Error('nope'), { status: 404 }); } });
    await expect(store.load({ source: 'p' })).rejects.toMatchObject({ code: 'not_found', retryable: false });
    expect(n).toBe(1);
  });

  it('cancelling during the backoff stops retrying', async () => {
    const store = new DataStore({ retries: 5, retryDelayMs: 1000 });
    let n = 0;
    store.register({ id: 'p', fetch: async () => { n++; throw new TypeError('offline'); } });
    const ac = new AbortController();
    const p = store.load({ source: 'p' }, { signal: ac.signal });
    const assertion = expect(p).rejects.toMatchObject({ code: 'aborted' });
    await vi.advanceTimersByTimeAsync(10);
    ac.abort();
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
    expect(n).toBe(1);
  });
});

describe('DataStore — concurrency', () => {
  it('never runs more than maxConcurrent non-batched fetches at once', async () => {
    const store = new DataStore({ maxConcurrent: 2 });
    let active = 0;
    let peak = 0;
    store.register({ id: 'p', fetch: async () => { active++; peak = Math.max(peak, active); await new Promise((r) => setTimeout(r, 5)); active--; return { items: [] }; } });
    await Promise.all(Array.from({ length: 7 }, (_, i) => store.load({ source: 'p', skip: i })));
    expect(peak).toBe(2);
  });
});

describe('DataStore — stale-while-revalidate', () => {
  it('serves stale data immediately and refreshes in the background', async () => {
    let t = 0;
    const store = new DataStore({ now: () => t });
    let version = 1;
    store.register({ id: 'p', cache: { ttlMs: 100, staleMs: 1000 }, fetch: async () => ({ items: [{ v: version }] }) });
    const changed = vi.fn();
    store.onChange(changed);

    expect((await store.load({ source: 'p' })).items[0]).toEqual({ v: 1 });
    version = 2;
    t = 500; // stale, within the stale window
    expect((await store.load({ source: 'p' })).items[0]).toEqual({ v: 1 }); // answered instantly with the old value
    await flush();
    await flush();
    expect(changed).toHaveBeenCalledTimes(1);
    t = 510;
    expect((await store.load({ source: 'p' })).items[0]).toEqual({ v: 2 }); // the refreshed value is fresh now
    expect(store.stats().staleHits).toBe(1);
  });

  it('beyond ttl + stale window the entry is dropped and refetched normally', async () => {
    let t = 0;
    const store = new DataStore({ now: () => t });
    const fetch = vi.fn(async () => ({ items: [] }));
    store.register({ id: 'p', cache: { ttlMs: 100, staleMs: 100 }, fetch });
    await store.load({ source: 'p' });
    t = 1000;
    await store.load({ source: 'p' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('a failing background refresh never breaks the already delivered result', async () => {
    let t = 0;
    const store = new DataStore({ now: () => t, retries: 0 });
    let fail = false;
    store.register({ id: 'p', cache: { ttlMs: 10, staleMs: 1000 }, fetch: async () => { if (fail) throw new TypeError('x'); return { items: [1] as never }; } });
    await store.load({ source: 'p' });
    fail = true;
    t = 100;
    await expect(store.load({ source: 'p' })).resolves.toBeDefined();
    await flush();
    await flush();
    expect(store.stats().errors).toBe(1);
  });
});

describe('DataStore — SSR priming', () => {
  it('serves primed results without any fetch', async () => {
    const store = new DataStore();
    const fetch = vi.fn(async () => ({ items: [] }));
    store.register({ id: 'p', fetch });
    store.prime([{ request: { source: 'p', take: 8, params: { cat: 'x', q: '' } }, result: { items: rows(2), total: 20 } }]);
    const r = await store.load({ source: 'p', take: 8, params: { q: '', cat: 'x' } }); // different param order / empty noise
    expect(r.total).toBe(20);
    expect(fetch).not.toHaveBeenCalled();
    expect(store.stats().primed).toBe(1);
  });

  it('primed entries expire after primeTtlMs', async () => {
    let t = 0;
    const store = new DataStore({ now: () => t, primeTtlMs: 1000 });
    const fetch = vi.fn(async () => ({ items: [] }));
    store.register({ id: 'p', fetch });
    store.prime([{ request: { source: 'p' }, result: { items: [] } }]);
    t = 500;
    await store.load({ source: 'p' });
    expect(fetch).not.toHaveBeenCalled();
    t = 1500;
    await store.load({ source: 'p' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('ignores malformed prime entries', () => {
    const store = new DataStore();
    store.prime([null as never, { request: { source: '' }, result: { items: [] } }, { request: { source: 'p' }, result: { nope: 1 } as never }, { request: { source: 'ok' }, result: { items: [] } }]);
    expect(store.stats().entries).toBe(1);
  });

  it('exportState → prime on another store round-trips (TransferState)', async () => {
    const server = new DataStore({ defaultTtlMs: 60_000 });
    server.register({ id: 'p', fetch: async (r) => ({ items: rows(2, r.skip), total: 9 }) });
    await server.load({ source: 'p', skip: 0, take: 2, sort: [{ field: 'id', dir: 'desc' }] });
    await server.load({ source: 'p', skip: 2, take: 2 });
    const state = JSON.parse(JSON.stringify(server.exportState())); // crosses the wire as JSON

    const client = new DataStore();
    const fetch = vi.fn();
    client.register({ id: 'p', fetch });
    client.prime(state);
    expect((await client.load({ source: 'p', skip: 2, take: 2 })).items[0]).toMatchObject({ id: 2 });
    expect((await client.load({ source: 'p', skip: 0, take: 2, sort: [{ field: 'id', dir: 'desc' }] })).total).toBe(9);
    expect(fetch).not.toHaveBeenCalled();
    expect(server.exportState({ source: 'other' })).toEqual([]);
  });
});

describe('toDataError', () => {
  it('maps http statuses, aborts and network failures', () => {
    expect(toDataError({ status: 404 }, 's')).toMatchObject({ code: 'not_found', retryable: false });
    expect(toDataError({ status: 403 }, 's').code).toBe('forbidden');
    expect(toDataError({ status: 400 }, 's').code).toBe('bad_request');
    expect(toDataError({ status: 503 }, 's')).toMatchObject({ code: 'server', retryable: true });
    expect(toDataError({ status: 429 }, 's').retryable).toBe(true);
    expect(toDataError(Object.assign(new Error('x'), { name: 'AbortError' }), 's').code).toBe('aborted');
    expect(toDataError(new TypeError('Failed to fetch'), 's')).toMatchObject({ code: 'network', retryable: true });
    expect(toDataError(new Error('weird'), 's')).toMatchObject({ code: 'unknown', retryable: false });
    const e = new DataError('timeout', 't');
    expect(toDataError(e, 's')).toBe(e);
  });
});

describe('DataStore — events & observability', () => {
  it('emits hit / miss / join / fetch events', async () => {
    const events: string[] = [];
    const store = new DataStore({ defaultTtlMs: 1000, onEvent: (e) => events.push(e.type) });
    store.register({ id: 'p', fetch: async () => ({ items: [] }) });
    await Promise.all([store.load({ source: 'p' }), store.load({ source: 'p' })]);
    await store.load({ source: 'p' });
    expect(events).toEqual(expect.arrayContaining(['miss', 'join', 'fetch', 'hit']));
  });

  it('loadMany never rejects', async () => {
    const store = new DataStore({ retries: 0 });
    store.register({ id: 'ok', rows: rows(1) });
    const r = await store.loadMany([{ source: 'ok' }, { source: 'ghost' }]);
    expect(r.map((x) => x.status)).toEqual(['fulfilled', 'rejected']);
  });

  it('prefetch warms the cache and swallows errors', async () => {
    const store = new DataStore({ defaultTtlMs: 1000, retries: 0 });
    const fetch = vi.fn(async () => ({ items: rows(1) }));
    store.register({ id: 'ok', fetch });
    await store.prefetch([{ source: 'ok' }, { source: 'ghost' }]);
    expect(store.peek({ source: 'ok' })?.items).toHaveLength(1);
    await store.load({ source: 'ok' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
