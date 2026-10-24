import { compileTemplate, hasTemplate, readRef } from './template';
import type { DataScope } from './scope';

export interface ResolvedParams {
  values: Record<string, unknown>;
  /** params whose reference/template resolved to nothing (route param missing, empty query …) */
  unresolved: string[];
}

const isEmpty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/**
 * Param values may be:
 *   literals                  'shoes' · 12 · true · ['a','b']
 *   typed references          '@route.slug' · '@query.page' · '@parent.categoryId' · '@global.tenantId'   (keeps the type: numbers stay numbers)
 *   templates                 'cat-{{route.slug}}'
 *   '@@x'                     the literal text '@x'
 * Objects / arrays are resolved recursively (depth ≤ 4).
 */
export function resolveParams(raw: Record<string, unknown> | undefined | null, scope: DataScope): ResolvedParams {
  const values: Record<string, unknown> = {};
  const unresolved: string[] = [];
  if (!raw) return { values, unresolved };

  for (const key of Object.keys(raw)) {
    const r = resolveValue(raw[key], scope, 0);
    if (r.isRef && isEmpty(r.value)) {
      unresolved.push(key); // a reference to nothing is "no value", not an empty-string filter
      continue;
    }
    if (r.value !== undefined) values[key] = r.value;
  }
  return { values, unresolved };
}

function resolveValue(v: unknown, scope: DataScope, depth: number): { value: unknown; isRef: boolean } {
  if (typeof v === 'string') {
    if (v.startsWith('@@')) return { value: v.slice(1), isRef: false };
    if (v.startsWith('@') && v.length > 1) return { value: readRef(scope, v.slice(1)), isRef: true };
    if (hasTemplate(v)) return { value: compileTemplate(v).render(scope, 'text') || undefined, isRef: true };
    return { value: v, isRef: false };
  }
  if (depth >= 4) return { value: v, isRef: false };
  if (Array.isArray(v)) {
    let ref = false;
    const out = v.map((x) => {
      const r = resolveValue(x, scope, depth + 1);
      ref ||= r.isRef;
      return r.value;
    });
    return { value: out, isRef: ref };
  }
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    let ref = false;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object)) {
      const r = resolveValue((v as Record<string, unknown>)[k], scope, depth + 1);
      ref ||= r.isRef;
      if (r.value !== undefined) out[k] = r.value;
    }
    return { value: out, isRef: ref };
  }
  return { value: v, isRef: false };
}

/** True when any param (recursively) references the row / parent scope → can only be resolved after the parent rows exist. */
export function paramsDependOnRow(raw: Record<string, unknown> | undefined | null): boolean {
  if (!raw) return false;
  const check = (v: unknown, depth: number): boolean => {
    if (typeof v === 'string') {
      if (v.startsWith('@@')) return false;
      if (v.startsWith('@')) return !/^(route|query|page|global)(\.|\[|$)/.test(v.slice(1)); // row.x, parent.x, $index and bare fields all need a record
      if (hasTemplate(v)) {
        const c = compileTemplate(v);
        return c.usesRow || c.usesParent || c.roots.some((r) => r.startsWith('$'));
      }
      return false;
    }
    if (depth >= 4) return false;
    if (Array.isArray(v)) return v.some((x) => check(x, depth + 1));
    if (v && typeof v === 'object') return Object.values(v as object).some((x) => check(x, depth + 1));
    return false;
  };
  return Object.values(raw).some((v) => check(v, 0));
}
