import { DynamicValueType } from '../models/DynamicData';
import type { DataFilter, DataSort } from '../models/DataSourceSetting';

/** a field of the schema flattened to a path (`address.city`) */
export interface FlatField {
  path: string;
  label: string;
  type: DynamicValueType;
}

/* ------------------------------------------------------------------ */
/* filter / sort (static lists)                                        */
/* ------------------------------------------------------------------ */

const DATE_LIKE = /^\d{4}-\d{2}-\d{2}/;

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toTime(v: unknown): number | null {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'string' && DATE_LIKE.test(v)) {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === '';
}

/** numbers -> numbers, dates -> dates, everything else -> natural string order */
export function compareValues(a: unknown, b: unknown): number {
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na !== null && nb !== null) return na - nb;
  const ta = toTime(a);
  const tb = toTime(b);
  if (ta !== null && tb !== null) return ta - tb;
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' });
}

function matches(actual: unknown, filter: DataFilter): boolean {
  const empty = isEmpty(actual);
  if (filter.operator === 'empty') return empty;
  if (filter.operator === 'notEmpty') return !empty;

  const expected = filter.value ?? '';
  const text = String(actual ?? '').toLowerCase();
  const needle = expected.toLowerCase();
  switch (filter.operator) {
    case 'eq':
      return compareValues(actual, expected) === 0 && (!empty || expected === '');
    case 'ne':
      return !(compareValues(actual, expected) === 0 && (!empty || expected === ''));
    case 'contains':
      return text.includes(needle);
    case 'startsWith':
      return text.startsWith(needle);
    case 'endsWith':
      return text.endsWith(needle);
    case 'gt':
      return !empty && compareValues(actual, expected) > 0;
    case 'gte':
      return !empty && compareValues(actual, expected) >= 0;
    case 'lt':
      return !empty && compareValues(actual, expected) < 0;
    case 'lte':
      return !empty && compareValues(actual, expected) <= 0;
    default:
      return true;
  }
}

export function applyFilters(rows: any[], filters?: DataFilter[] | null): any[] {
  const active = (filters ?? []).filter((f) => f.field && f.operator);
  if (!active.length) return rows;
  return rows.filter((row) => active.every((f) => matches(fieldValue(row, f.field), f)));
}

/** stable multi-key sort; empty values are always placed last */
export function applySorts(rows: any[], sorts?: DataSort[] | null): any[] {
  const active = (sorts ?? []).filter((s) => s.field);
  if (!active.length) return rows;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((x, y) => {
      for (const s of active) {
        const a = fieldValue(x.row, s.field);
        const b = fieldValue(y.row, s.field);
        const ea = isEmpty(a);
        const eb = isEmpty(b);
        if (ea || eb) {
          if (ea && eb) continue;
          return ea ? 1 : -1;
        }
        const c = compareValues(a, b);
        if (c !== 0) return s.direction === 'desc' ? -c : c;
      }
      return x.index - y.index;
    })
    .map((x) => x.row);
}
function fieldValue(row: any, field: string) {
  throw new Error('Function not implemented.');
}
