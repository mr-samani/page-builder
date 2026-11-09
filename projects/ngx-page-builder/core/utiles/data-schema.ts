import { DynamicDataStructure, DynamicValueType } from '../models/DynamicData';
import type { DataFilter, DataSort } from '../models/DataSourceSetting';
import { DEFAULT_IMAGE_URL } from '../consts/defaults';

/** one record of a collection */
export type DataRow = DynamicDataStructure[];

/** a field of the schema flattened to a path (`address.city`) */
export interface FlatField {
  path: string;
  label: string;
  type: DynamicValueType;
}

/* ------------------------------------------------------------------ */
/* schema                                                              */
/* ------------------------------------------------------------------ */

/** true when the source is a collection (list of records) and not a single object */
export function isCollectionSource(ds: DynamicDataStructure): boolean {
  return ds.type === DynamicValueType.Array || !!ds.list || !!ds.values?.length;
}

/** copy of a field without its data (a schema must not carry values) */
function stripValue(field: DynamicDataStructure): DynamicDataStructure {
  const { value, ...rest } = field;
  return { ...rest, values: field.values ? field.values.map(stripValue) : field.values };
}

export function schemaFromRow(row: DataRow): DynamicDataStructure[] {
  return row.map(stripValue);
}

/**
 * The structure of a collection that is known WITHOUT loading any data:
 *  1. `fields`
 *  2. `values` (Array type)
 *  3. the first record of a static `list`
 * returns null when the structure can only be discovered by calling the list function.
 */
export function declaredSchema(ds: DynamicDataStructure): DynamicDataStructure[] | null {
  if (ds.values?.length) return ds.values;
  if (Array.isArray(ds.list) && ds.list.length > 0) return schemaFromRow(ds.list[0]);
  return null;
}

/** find a (nested) field by path: `name` or `address.city` */
export function findField(
  fields: DynamicDataStructure[] | null | undefined,
  path: string | null | undefined,
): DynamicDataStructure | undefined {
  if (!fields || !path) return undefined;
  let current: DynamicDataStructure[] | null | undefined = fields;
  let found: DynamicDataStructure | undefined;
  for (const part of path.split('.')) {
    found = current?.find((f) => f.name === part);
    if (!found) return undefined;
    current = found.values;
  }
  return found;
}

/** value of a (nested) field in one record */
export function fieldValue(row: DataRow | undefined, path: string | undefined): unknown {
  return findField(row, path)?.value;
}

/** leaves of the schema as a flat list (used by filter / sort field selectors) */
export function flattenFields(fields: DynamicDataStructure[] | null | undefined, parent?: FlatField): FlatField[] {
  const result: FlatField[] = [];
  for (const f of fields ?? []) {
    const path = parent ? `${parent.path}.${f.name}` : f.name;
    const label = parent ? `${parent.label} › ${f.displayName || f.name}` : f.displayName || f.name;
    if (f.values?.length) {
      result.push(...flattenFields(f.values, { path, label, type: f.type }));
    } else {
      result.push({ path, label, type: f.type });
    }
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* sample data (designer, when the real list is empty)                 */
/* ------------------------------------------------------------------ */

const IMAGE_NAME =
  /(^(image|img|photo|picture|thumb|thumbnail|avatar|cover|logo|banner)|(image|img|photo|picture|thumb|thumbnail|avatar|cover|logo|banner)s?$)/i;

export function sampleValue(field: DynamicDataStructure, index: number): unknown {
  switch (field.type) {
    case DynamicValueType.Int:
      return (index + 1) * 10;
    case DynamicValueType.Boolean:
      return index % 2 === 0;
    case DynamicValueType.Date:
      return new Date(Date.UTC(2025, 0, 1 + index)).toISOString().slice(0, 10);
    case DynamicValueType.Time:
      return `${String(9 + (index % 10)).padStart(2, '0')}:00`;
    case DynamicValueType.DateTime:
      return new Date(Date.UTC(2025, 0, 1 + index, 9)).toISOString();
    case DynamicValueType.Array:
      return [];
    case DynamicValueType.Object:
      return null;
    default:
      return IMAGE_NAME.test(field.name) ? DEFAULT_IMAGE_URL : `${field.displayName || field.name} ${index + 1}`;
  }
}

function sampleField(field: DynamicDataStructure, index: number): DynamicDataStructure {
  if (field.values?.length) {
    return { ...field, value: null, values: field.values.map((c) => sampleField(c, index)) };
  }
  return { ...field, value: sampleValue(field, index) };
}

export function buildSampleRows(schema: DynamicDataStructure[], count: number): DataRow[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => schema.map((f) => sampleField(f, i)));
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

export function applyFilters(rows: DataRow[], filters?: DataFilter[] | null): DataRow[] {
  const active = (filters ?? []).filter((f) => f.field && f.operator);
  if (!active.length) return rows;
  return rows.filter((row) => active.every((f) => matches(fieldValue(row, f.field), f)));
}

/** stable multi-key sort; empty values are always placed last */
export function applySorts(rows: DataRow[], sorts?: DataSort[] | null): DataRow[] {
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
