import { stableStringify } from './stable-json';
import type { DataRequest, DataSourceDefinition, NormalizedRequest, SortSpec } from './types';

/** A value that means "no filter": it is removed so `{q:''}` and `{}` share one cache entry. */
function isEmptyParam(v: unknown): boolean {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

function toInt(v: unknown, min: number, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.max(min, Math.trunc(n)) : fallback;
}

/** Canonical form of a request (defaults filled, noise removed, lists sorted). */
export function normalizeRequest(req: DataRequest, def?: Pick<DataSourceDefinition, 'pagination' | 'kind'>): NormalizedRequest {
  const mode = req.mode ?? (def?.kind === 'record' ? 'single' : 'list');

  let take: number | null = null;
  if (req.take !== undefined && req.take !== null) {
    const t = toInt(req.take, 0, 0);
    take = t > 0 ? t : null; // 0 / garbage = "no explicit page size"
  } else if (mode === 'single') take = 1;
  else if (def?.pagination?.defaultTake) take = def.pagination.defaultTake;
  const max = def?.pagination?.maxTake;
  if (take !== null && max && take > max) take = max;

  const sort: SortSpec[] = [];
  const seen = new Set<string>();
  for (const s of req.sort ?? []) {
    if (!s || typeof s.field !== 'string' || !s.field || seen.has(s.field)) continue;
    seen.add(s.field);
    sort.push({ field: s.field, dir: s.dir === 'desc' ? 'desc' : 'asc' });
  }

  const params: Record<string, unknown> = {};
  for (const k of Object.keys(req.params ?? {}).sort()) {
    const v = (req.params as Record<string, unknown>)[k];
    if (!isEmptyParam(v)) params[k] = v;
  }

  const fields = [...new Set((req.fields ?? []).filter((f) => typeof f === 'string' && f))].sort();
  const search = typeof req.search === 'string' && req.search.trim() ? req.search.trim() : null;

  return {
    source: String(req.source ?? '').trim(),
    skip: mode === 'single' ? 0 : toInt(req.skip, 0, 0),
    take,
    sort,
    params,
    fields,
    search,
    mode,
    cursor: req.cursor ? String(req.cursor) : null,
  };
}

/**
 * The cache / dedupe / priming key: canonical JSON of the normalized request.
 * Property order is fixed here (not alphabetical) so the .NET side can reproduce it exactly.
 */
export function requestKey(n: NormalizedRequest): string {
  return (
    '{"source":' + JSON.stringify(n.source) +
    ',"skip":' + n.skip +
    ',"take":' + (n.take === null ? 'null' : n.take) +
    ',"sort":' + stableStringify(n.sort) +
    ',"params":' + stableStringify(n.params) +
    ',"fields":' + stableStringify(n.fields) +
    ',"search":' + (n.search === null ? 'null' : JSON.stringify(n.search)) +
    ',"mode":"' + n.mode + '"' +
    ',"cursor":' + (n.cursor === null ? 'null' : JSON.stringify(n.cursor)) +
    '}'
  );
}

export function keyOf(req: DataRequest, def?: Pick<DataSourceDefinition, 'pagination' | 'kind'>): string {
  return requestKey(normalizeRequest(req, def));
}
