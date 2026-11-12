import { DynamicValueType } from '../models/DynamicData';
import type { DynamicDataStructure } from '../models/DynamicData';
import type { DataFilter, DataSort } from '../models/DataSourceSetting';
import { getByPath } from './data-binding';

/** a field of the schema flattened to a path (`address.city`) */
export interface FlatField {
  path: string;
  label: string;
  type: DynamicValueType;
}

/** value of a (nested) field of a record */
function fieldValue(row: any, field: string): unknown {
  return getByPath(row, field);
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

/* ------------------------------------------------------------------ */
/* structure                                                           */
/* ------------------------------------------------------------------ */

/** a field that holds one value (it can be shown as text) */
export function isLeafField(field: DynamicDataStructure): boolean {
  return field.type !== DynamicValueType.Object && field.type !== DynamicValueType.Array;
}

/** a field that can be bound to a block: lists never can */
export function isBindableField(field: DynamicDataStructure): boolean {
  return field.type !== DynamicValueType.Array;
}

/** finds a field by its path (`address.city`) */
export function findField(fields: DynamicDataStructure[] | null | undefined, path: string): DynamicDataStructure | null {
  let current: DynamicDataStructure | undefined;
  let level = fields ?? [];
  for (const segment of path.split('.').filter(Boolean)) {
    current = level.find((f) => f.name === segment);
    if (!current) return null;
    level = current.fields ?? [];
  }
  return current ?? null;
}

/** all value fields of a structure as paths (objects are expanded, lists are skipped) */
export function flattenFields(fields: DynamicDataStructure[] | null | undefined, prefix = '', labelPrefix = ''): FlatField[] {
  const result: FlatField[] = [];
  for (const field of fields ?? []) {
    const path = prefix ? `${prefix}.${field.name}` : field.name;
    const label = labelPrefix ? `${labelPrefix} › ${field.displayName || field.name}` : field.displayName || field.name;
    if (field.type === DynamicValueType.Object) {
      result.push(...flattenFields(field.fields, path, label));
    } else if (field.type !== DynamicValueType.Array) {
      result.push({ path, label, type: field.type });
    }
  }
  return result;
}

/** structure inferred from a real record (used when a data source does not declare `fields`) */
export function schemaFromRow(row: unknown): DynamicDataStructure[] {
  if (row === null || typeof row !== 'object' || Array.isArray(row)) return [];
  return Object.entries(row).map(([name, value]): DynamicDataStructure => {
    const base = { name, displayName: name };
    if (Array.isArray(value)) return { ...base, type: DynamicValueType.Array, fields: schemaFromRow(value[0]) };
    if (value instanceof Date) return { ...base, type: DynamicValueType.DateTime };
    if (value !== null && typeof value === 'object') {
      return { ...base, type: DynamicValueType.Object, fields: schemaFromRow(value) };
    }
    if (typeof value === 'number') return { ...base, type: DynamicValueType.Int };
    if (typeof value === 'boolean') return { ...base, type: DynamicValueType.Boolean };
    return { ...base, type: DynamicValueType.String };
  });
}

/* ------------------------------------------------------------------ */
/* sample data (designer)                                              */
/* ------------------------------------------------------------------ */

function sampleValue(field: DynamicDataStructure, index: number): unknown {
  const day = new Date(Date.UTC(2025, 0, 1 + index));
  switch (field.type) {
    case DynamicValueType.Int:
      return index + 1;
    case DynamicValueType.Boolean:
      return index % 2 === 0;
    case DynamicValueType.Date:
      return day.toISOString().slice(0, 10);
    case DynamicValueType.Time:
      return `${String(9 + (index % 8)).padStart(2, '0')}:00`;
    case DynamicValueType.DateTime:
      return day.toISOString();
    case DynamicValueType.Object:
      return buildSampleRow(field.fields, index);
    case DynamicValueType.Array:
      return field.fields?.length ? [0, 1].map((i) => buildSampleRow(field.fields, i)) : [];
    default:
      return `${field.displayName || field.name} ${index + 1}`;
  }
}

/** one record filled with sample values: the designer shows it instead of real data */
export function buildSampleRow(fields: DynamicDataStructure[] | null | undefined, index: number): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const field of fields ?? []) {
    row[field.name] = sampleValue(field, index);
  }
  return row;
}

export function buildSampleRows(fields: DynamicDataStructure[] | null | undefined, count: number): Record<string, unknown>[] {
  return Array.from({ length: count }, (_, index) => buildSampleRow(fields, index));
}
