import { describe, expect, it, vi } from 'vitest';
import { createHttpBatchFetcher } from './http-fetcher';
import { DataStore } from './store';
import { normalizeRequest } from './request';

const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init });
const items = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i), request: normalizeRequest({ source: i % 2 ? 'cats' : 'products', skip: i, take: 12, fields: ['title', 'id'], params: { q: 'x' } }) }));
const ctx = () => ({ signal: new AbortController().signal });

describe('createHttpBatchFetcher', () => {
  it('POSTs ALL requests in one call with the documented wire format', async () => {
    const fetchImpl = vi.fn(async () => json({ results: { '0': { items: [] }, '1': { items: [], total: 3 } } }));
    const f = createHttpBatchFetcher({ url: '/api/public/data/batch', fetchImpl: fetchImpl as never, headers: async () => ({ 'x-tenant': 't1' }) });
    const out = await f(items(2), ctx());
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/public/data/batch');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['x-tenant']).toBe('t1');
    expect(JSON.parse(init.body as string)).toEqual({
      requests: [
        { id: '0', source: 'products', skip: 0, take: 12, sort: [], params: { q: 'x' }, fields: ['id', 'title'], search: null, mode: 'list', cursor: null },
        { id: '1', source: 'cats', skip: 1, take: 12, sort: [], params: { q: 'x' }, fields: ['id', 'title'], search: null, mode: 'list', cursor: null },
      ],
    });
    expect(out['1']).toMatchObject({ total: 3 });
  });

  it('merges per-request errors into the outcome map (partial success)', async () => {
    const f = createHttpBatchFetcher({ url: '/b', fetchImpl: (async () => json({ results: { '0': { items: [] } }, errors: { '1': { code: 'not_found', status: 404, message: 'x' } } })) as never });
    const out = await f(items(2), ctx());
    expect(out['0']).toEqual({ items: [] });
    expect(out['1']).toEqual({ error: { code: 'not_found', status: 404, message: 'x' } });
  });

  it('maps HTTP failures to DataErrors (and uses the problem+json message)', async () => {
    const f = (status: number, body: unknown = {}) => createHttpBatchFetcher({ url: '/b', fetchImpl: (async () => json(body, { status })) as never });
    await expect(f(500, { title: 'Boom' })(items(1), ctx())).rejects.toMatchObject({ code: 'server', status: 500, message: 'Boom', retryable: true });
    await expect(f(403)(items(1), ctx())).rejects.toMatchObject({ code: 'forbidden' });
    await expect(f(400, { message: 'bad take' })(items(1), ctx())).rejects.toMatchObject({ code: 'bad_request', message: 'bad take' });
    await expect(f(429)(items(1), ctx())).rejects.toMatchObject({ retryable: true });
  });

  it('turns network failures into retryable errors but lets aborts through', async () => {
    const net = createHttpBatchFetcher({ url: '/b', fetchImpl: (async () => { throw new TypeError('Failed to fetch'); }) as never });
    await expect(net(items(1), ctx())).rejects.toMatchObject({ code: 'network', retryable: true });
    const abort = createHttpBatchFetcher({ url: '/b', fetchImpl: (async () => { throw Object.assign(new Error('a'), { name: 'AbortError' }); }) as never });
    await expect(abort(items(1), ctx())).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects non-JSON and bodies of the wrong shape without retrying', async () => {
    const bad = createHttpBatchFetcher({ url: '/b', fetchImpl: (async () => new Response('<html>', { status: 200 })) as never });
    await expect(bad(items(1), ctx())).rejects.toMatchObject({ code: 'invalid_result', retryable: false });
    const nul = createHttpBatchFetcher({ url: '/b', fetchImpl: (async () => json(null)) as never });
    await expect(nul(items(1), ctx())).rejects.toMatchObject({ code: 'invalid_result' });
  });

  it('works end to end with the store: 5 blocks → ONE http call', async () => {
    const fetchImpl = vi.fn(async (_u: string, init: RequestInit) => {
      const reqs = (JSON.parse(init.body as string) as { requests: { id: string; source: string; skip: number }[] }).requests;
      return json({ results: Object.fromEntries(reqs.map((r) => [r.id, { items: [{ s: r.source, skip: r.skip }], total: 99 }])) });
    });
    const store = new DataStore().setBatchFetcher(null, createHttpBatchFetcher({ url: '/api/data', fetchImpl: fetchImpl as never }));
    const r = await Promise.all([
      store.load({ source: 'products', take: 8 }),
      store.load({ source: 'products', take: 8, skip: 8 }),
      store.load({ source: 'categories' }),
      store.load({ source: 'products', take: 8 }), // duplicate → joined, not sent twice
      store.load({ source: 'brands' }),
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect((JSON.parse(fetchImpl.mock.calls[0][1].body as string) as { requests: unknown[] }).requests).toHaveLength(4);
    expect(r[1].items[0]).toEqual({ s: 'products', skip: 8 });
  });

  it('fails clearly when fetch does not exist', async () => {
    const original = globalThis.fetch;
    // @ts-expect-error simulate an old runtime
    delete globalThis.fetch;
    try {
      await expect(createHttpBatchFetcher({ url: '/b' })(items(1), ctx())).rejects.toMatchObject({ code: 'network' });
    } finally {
      globalThis.fetch = original;
    }
  });
});
