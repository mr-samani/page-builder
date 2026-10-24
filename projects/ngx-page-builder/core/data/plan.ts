import type { DataSourceSetting } from '../models/DataSourceSetting';
import { compileBinding, resolveBinding, type BindableItem, type CompiledBinding } from './item-binding';
import { compileTemplate, hasTemplate } from './template';
import { createScope } from './scope';
import { normalizeRequest, requestKey } from './request';
import { resolveSettingRequest } from './setting';
import type { DataContext, DataMode, DataRequest, DataSourceDefinition } from './types';

/** The parts of a block the data layer reads. `PageItem` (and its JSON) satisfy this. */
export interface PlanItem extends BindableItem {
  id: string;
  children?: PlanItem[];
  template?: PlanItem | null;
  dataSource?: (DataSourceSetting & { binding?: string }) | null;
}

export type DefinitionLookup = (id: string) => Pick<DataSourceDefinition, 'kind' | 'pagination' | 'params' | 'fields'> | undefined;

export const isOwner = (i: PlanItem): boolean => !!i.dataSource?.id;
export const templateRootsOf = (owner: PlanItem): PlanItem[] => (owner.template ? [owner.template] : (owner.children ?? []));

/** Depth-first walk over children AND template subtrees. Return `false` from the visitor to skip a subtree. */
export function walkItems(roots: readonly PlanItem[], visit: (item: PlanItem, info: { parent?: PlanItem; depth: number; ownerDepth: number }) => boolean | void, parent?: PlanItem, depth = 0, ownerDepth = 0): void {
  for (const item of roots ?? []) {
    if (!item) continue;
    if (visit(item, { parent, depth, ownerDepth }) === false) continue;
    const od = isOwner(item) ? ownerDepth + 1 : ownerDepth;
    if (item.template) walkItems([item.template], visit, item, depth + 1, od);
    if (item.children?.length) walkItems(item.children, visit, item, depth + 1, od);
  }
}

export interface FieldUsage {
  /** fields of the record(s) of THIS scope */
  fields: Set<string>;
  /** a `{{row}}` style reference exists → the whole record is needed, no projection */
  whole: boolean;
  /** fields the inner (nested) scopes read from THIS scope through `parent.x` */
  parentNeeds: Set<string>;
}

/** Which record fields do the blocks of one scope read? (used for the `fields` projection sent to the server) */
export function usageOfScope(items: readonly PlanItem[]): FieldUsage {
  const usage: FieldUsage = { fields: new Set(), whole: false, parentNeeds: new Set() };
  const visit = (item: PlanItem) => {
    const c: CompiledBinding = compileBinding(resolveBinding(item));
    c.fields.forEach((f) => usage.fields.add(f));
    c.parentFields.forEach((f) => usage.parentNeeds.add(f));
    usage.whole ||= c.usesWholeRow;

    if (isOwner(item)) {
      // the nested block's filters are resolved against THIS scope's record …
      const pf = fieldsOfParams(item.dataSource!);
      pf.fields.forEach((f) => usage.fields.add(f));
      usage.whole ||= pf.whole;
      // … and its template may read our record through `parent.x`
      usageOfScope(templateRootsOf(item)).parentNeeds.forEach((f) => usage.fields.add(f));
      return; // its own template is another scope
    }
    item.children?.forEach(visit);
    if (item.template) visit(item.template);
  };
  items.forEach(visit);
  return usage;
}

function fieldsOfParams(ds: DataSourceSetting): { fields: Set<string>; whole: boolean } {
  const fields = new Set<string>();
  let whole = false;
  const take = (path: string) => {
    const root = path.split(/[.[]/)[0];
    if (!root || root.startsWith('$')) return;
    if (root === 'row') {
      const second = path.split(/[.[]/)[1];
      if (second) fields.add(second);
      else whole = true;
    } else if (!['route', 'query', 'page', 'global', 'parent'].includes(root)) fields.add(root);
  };
  const scan = (v: unknown, depth: number) => {
    if (typeof v === 'string') {
      if (v.startsWith('@@')) return;
      if (v.startsWith('@')) take(v.slice(1));
      else if (hasTemplate(v)) {
        const c = compileTemplate(v);
        c.fields.forEach((f) => fields.add(f));
        whole ||= c.usesWholeRow;
      }
    } else if (depth < 4 && Array.isArray(v)) v.forEach((x) => scan(x, depth + 1));
    else if (depth < 4 && v && typeof v === 'object') Object.values(v as object).forEach((x) => scan(x, depth + 1));
  };
  scan(ds.params, 0);
  if (ds.search) scan(ds.search, 0);
  return { fields, whole };
}

export interface PlannedRequest {
  itemId: string;
  source: string;
  mode: DataMode;
  request: DataRequest;
  /** canonical key (same one the DataStore uses) */
  key: string;
  /** inside another collection and filtered by its record → can only be fetched once that record exists */
  dependsOnRow: boolean;
  /** required values (route slug …) are missing → nothing to ask for */
  missing: string[];
  /** `ready` = can be requested right now */
  ready: boolean;
}

/**
 * Finds every data request a page needs, WITHOUT rendering anything:
 *  - the browser prefetches them in one batch before the DOM exists (no waterfall)
 *  - the server (Composer) uses the same rules to resolve them and ship the results with the page
 */
export function collectRequests(roots: readonly PlanItem[], opts: { ctx: DataContext; definition?: DefinitionLookup }): PlannedRequest[] {
  const out: PlannedRequest[] = [];
  const rootScope = createScope(opts.ctx);

  walkItems(roots, (item) => {
    if (!isOwner(item)) return;
    const setting = item.dataSource as DataSourceSetting;
    const def = opts.definition?.(setting.id);
    const usage = usageOfScope(templateRootsOf(item));
    const resolved = resolveSettingRequest(setting, rootScope, { def, fields: usage.whole ? undefined : [...usage.fields] });
    const n = normalizeRequest(resolved.request, def);
    out.push({
      itemId: item.id,
      source: setting.id,
      mode: resolved.mode,
      request: resolved.request,
      key: requestKey(n),
      dependsOnRow: resolved.dependsOnRow,
      missing: resolved.missing,
      ready: !resolved.dependsOnRow && resolved.missing.length === 0,
    });
  });
  return out;
}

/** Ready requests, one per distinct key. */
export function distinctReady(planned: readonly PlannedRequest[]): DataRequest[] {
  const seen = new Set<string>();
  const out: DataRequest[] = [];
  for (const p of planned) {
    if (!p.ready || seen.has(p.key)) continue;
    seen.add(p.key);
    out.push(p.request);
  }
  return out;
}
