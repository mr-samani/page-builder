import { DataError, type BatchFetcher, type BatchItem, type BatchOutcome, type DataErrorCode, type FetchContext } from './types';

/**
 * The browser / SSR side of the backend contract (see docs/dynamic-data.md).
 *
 *   POST {url}
 *   { "requests": [ { "id": "0", "source": "products", "skip": 0, "take": 12, "sort": [...], "params": {...},
 *                     "fields": ["id","title"], "search": null, "mode": "list", "cursor": null }, … ] }
 *
 *   200 { "results": { "0": { "items": [...], "total": 230 } },
 *         "errors":  { "1": { "code": "not_found", "message": "…", "status": 404 } } }
 *
 * One call carries every block of the page. The server answers each request independently (partial success).
 */
export interface HttpBatchOptions {
  url: string;
  /** default: global fetch (Node 18+, browsers, Angular SSR) */
  fetchImpl?: typeof fetch;
  /** e.g. tenant / auth headers; may be async */
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  credentials?: RequestCredentials;
}

export function createHttpBatchFetcher(options: HttpBatchOptions): BatchFetcher {
  return async (items: BatchItem[], ctx: FetchContext) => {
    const doFetch = options.fetchImpl ?? (globalThis.fetch as typeof fetch | undefined);
    if (!doFetch) throw new DataError('network', 'fetch is not available in this environment.');

    const extra = (await options.headers?.()) ?? {};
    const body = JSON.stringify({
      requests: items.map((i) => ({
        id: i.id,
        source: i.request.source,
        skip: i.request.skip,
        take: i.request.take,
        sort: i.request.sort,
        params: i.request.params,
        fields: i.request.fields,
        search: i.request.search,
        mode: i.request.mode,
        cursor: i.request.cursor,
      })),
    });

    let res: Response;
    try {
      res = await doFetch(options.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', ...extra },
        body,
        signal: ctx.signal,
        credentials: options.credentials,
      });
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') throw e;
      throw new DataError('network', (e as Error)?.message ?? 'Network error', { cause: e });
    }

    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const j = (await res.json()) as { message?: string; title?: string; detail?: string };
        message = j.message ?? j.detail ?? j.title ?? message;
      } catch {
        /* not json */
      }
      throw new DataError(codeFor(res.status), message, { status: res.status });
    }

    let json: { results?: Record<string, BatchOutcome>; errors?: Record<string, { code?: string; message?: string; status?: number }> };
    try {
      json = await res.json();
    } catch (e) {
      throw new DataError('invalid_result', 'The data endpoint did not return JSON.', { cause: e, retryable: false });
    }
    if (!json || typeof json !== 'object') throw new DataError('invalid_result', 'The data endpoint returned an unexpected body.', { retryable: false });

    const out: Record<string, BatchOutcome> = {};
    for (const [id, r] of Object.entries(json.results ?? {})) out[id] = r;
    for (const [id, e] of Object.entries(json.errors ?? {})) out[id] = { error: e };
    return out;
  };
}

function codeFor(status: number): DataErrorCode {
  if (status === 400 || status === 422) return 'bad_request';
  if (status === 401 || status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 408 || status === 429 || status >= 500) return 'server';
  return 'unknown';
}
