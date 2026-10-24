import type { DataSourceSetting } from '../models/DataSourceSetting';
import { paramsDependOnRow, resolveParams } from './params';
import type { DataScope } from './scope';
import type { DataMode, DataRequest, DataSourceDefinition, SortSpec } from './types';

export interface ResolvedRequest {
  request: DataRequest;
  /** required values that are missing (e.g. the `slug` of a details page) → do not fetch, there is nothing to ask for */
  missing: string[];
  /** 1-based page for `pager` pagination */
  page: number;
  take: number | null;
  mode: DataMode;
  dependsOnRow: boolean;
}

export interface ResolveOptions {
  def?: Pick<DataSourceDefinition, 'kind' | 'pagination' | 'params' | 'fields'>;
  /** projection computed from the template */
  fields?: string[];
  /** rows already shown (`loadMore` / `infinite`) */
  loaded?: number;
  cursor?: string | null;
}

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);
const SORT_PARAM = /^([\w.-]{1,64})(?::(asc|desc))?$/i;

/** Turns the block's settings + the current route/query/row into the request the store understands. */
export function resolveSettingRequest(setting: DataSourceSetting, scope: DataScope, opts: ResolveOptions = {}): ResolvedRequest {
  const def = opts.def;
  const mode: DataMode = setting.mode ?? (def?.kind === 'record' ? 'single' : 'list');
  const take = mode === 'single' ? 1 : (setting.maxResultCount ?? def?.pagination?.defaultTake ?? null) || null;

  // ---- paging
  const pagMode = setting.pagination?.mode ?? 'none';
  const base = Math.max(0, Math.trunc(setting.skipCount ?? 0));
  let page = 1;
  let skip = base;
  if (mode === 'list' && take) {
    if (pagMode === 'pager') {
      const n = Number(first(scope.ctx.query?.[setting.pagination?.pageParam || 'page']));
      page = Number.isFinite(n) && n >= 1 ? Math.trunc(n) : 1;
      skip = base + (page - 1) * take;
    } else if (pagMode === 'loadMore' || pagMode === 'infinite') {
      skip = base + Math.max(0, opts.loaded ?? 0);
    }
  }
  if (mode === 'single') skip = 0;

  // ---- params
  const resolved = resolveParams(setting.params as Record<string, unknown> | undefined, scope);
  const params = { ...resolved.values };
  const missing: string[] = [];
  for (const p of def?.params ?? []) {
    if (params[p.name] === undefined && p.defaultValue !== undefined) params[p.name] = p.defaultValue;
  }
  const required = new Set((def?.params ?? []).filter((p) => p.required).map((p) => p.name));
  for (const name of required) {
    const v = params[name];
    if (v === undefined || v === null || v === '') missing.push(name);
  }
  // a param bound to the route that has no value means "this is not a valid page" even without a schema
  const raw = (setting.params ?? {}) as Record<string, unknown>;
  for (const name of resolved.unresolved) {
    const v = raw[name];
    if (typeof v === 'string' && v.startsWith('@route.') && !missing.includes(name)) missing.push(name);
  }

  // ---- search
  const search = setting.search ? (resolveParams({ s: setting.search }, scope).values['s'] as string | undefined) : undefined;

  // ---- sort (a visitor may override through the URL, but only on fields the source allows)
  let sort: SortSpec[] | undefined = setting.sort?.length ? setting.sort : undefined;
  if (setting.sortParam) {
    const m = SORT_PARAM.exec((first(scope.ctx.query?.[setting.sortParam]) ?? '').trim());
    if (m && sortAllowed(m[1], def?.fields)) sort = [{ field: m[1], dir: (m[2]?.toLowerCase() as 'asc' | 'desc') ?? 'asc' }];
  }

  // ---- projection
  let fields: string[] | undefined;
  if (setting.projectFields !== false && opts.fields) {
    fields = [...new Set([...opts.fields, ...(opts.fields.length ? [setting.keyField || 'id'] : [])])];
  }

  const request: DataRequest = { source: setting.id, mode, skip, take, sort, params, fields, search: search ?? null, cursor: opts.cursor ?? null };
  const dependsOnRow = paramsDependOnRow(raw) || (!!setting.search && paramsDependOnRow({ s: setting.search }));
  return { request, missing, page, take, mode, dependsOnRow };
}

function sortAllowed(field: string, fields: DataSourceDefinition['fields']): boolean {
  if (!fields?.length) return true; // no schema here: the backend validates
  const sortable = fields.filter((f) => f.sortable);
  return (sortable.length ? sortable : fields).some((f) => f.name === field);
}
