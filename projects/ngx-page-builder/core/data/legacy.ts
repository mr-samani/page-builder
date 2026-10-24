import {
  DynamicDataInputType,
  DynamicValueType,
  type DynamicDataInputParameter,
  type DynamicDataStructure,
} from '../models/DynamicData';
import type { DataResult, DataRow, DataSourceDefinition, FieldDefinition, FieldType, NormalizedRequest, ParamDefinition, ParamType, SortSpec } from './types';

/**
 * Adapters for the previous `DynamicDataStructure[]` API, so existing host apps keep working while the
 * cells-with-metadata format (4 objects per value) is replaced by plain JSON rows.
 */

const FIELD_TYPE: Record<number, FieldType> = {
  [DynamicValueType.String]: 'string',
  [DynamicValueType.Int]: 'number',
  [DynamicValueType.Boolean]: 'boolean',
  [DynamicValueType.Date]: 'date',
  [DynamicValueType.Time]: 'time',
  [DynamicValueType.DateTime]: 'datetime',
  [DynamicValueType.Array]: 'array',
  [DynamicValueType.Object]: 'object',
};

const PARAM_TYPE: Record<number, ParamType> = {
  [DynamicDataInputType.Text]: 'text',
  [DynamicDataInputType.Textarea]: 'textarea',
  [DynamicDataInputType.Number]: 'number',
  [DynamicDataInputType.Select]: 'select',
  [DynamicDataInputType.AutoComplete]: 'autocomplete',
};

export function fieldTypeOf(t: DynamicValueType | undefined): FieldType | undefined {
  return t === undefined ? undefined : FIELD_TYPE[t];
}

export function toFieldDefinition(s: DynamicDataStructure): FieldDefinition {
  const f: FieldDefinition = { name: s.name, label: s.displayName || undefined, type: fieldTypeOf(s.type) };
  if (s.values?.length) f.fields = s.values.map(toFieldDefinition);
  return f;
}

export function toParamDefinition(p: DynamicDataInputParameter): ParamDefinition {
  return { name: p.name, label: p.label, type: PARAM_TYPE[p.type] ?? 'text', options: p.options, defaultValue: p.value };
}

/** `[{name:'title', value:'x'}, …]`  →  `{ title: 'x' }` (nested `values` / `list` are converted too). */
export function rowFromCells(cells: DynamicDataStructure[]): DataRow {
  const row: DataRow = {};
  for (const c of cells ?? []) {
    if (!c?.name) continue;
    if (Array.isArray(c.list)) row[c.name] = c.list.map(rowFromCells);
    else if (c.values?.length) row[c.name] = rowFromCells(c.values);
    else row[c.name] = c.value ?? null;
  }
  return row;
}

/** Inverse of {@link toFieldDefinition} for UI parts that still expect `DynamicDataStructure[]` (field pickers). */
export function fieldsToStructures(fields: readonly FieldDefinition[]): DynamicDataStructure[] {
  const rev: Record<string, DynamicValueType> = { string: DynamicValueType.String, number: DynamicValueType.Int, boolean: DynamicValueType.Boolean, date: DynamicValueType.Date, time: DynamicValueType.Time, datetime: DynamicValueType.DateTime, array: DynamicValueType.Array, object: DynamicValueType.Object };
  return fields.map((f) => ({
    name: f.name,
    displayName: f.label ?? f.name,
    type: rev[f.type ?? 'string'] ?? DynamicValueType.String,
    values: f.fields?.length ? fieldsToStructures(f.fields) : undefined,
  }));
}

/** Guesses field definitions from sample rows (used when a source does not publish a schema). */
export function inferFields(rows: readonly DataRow[], sample = 5): FieldDefinition[] {
  const byName = new Map<string, FieldDefinition>();
  for (const row of rows.slice(0, sample)) {
    for (const k of Object.keys(row ?? {})) {
      if (byName.has(k) && byName.get(k)!.type !== 'string') continue;
      byName.set(k, { name: k, label: k, type: inferType(row[k]) });
    }
  }
  return [...byName.values()];
}

function inferType(v: unknown): FieldType {
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'boolean';
  if (v instanceof Date) return 'datetime';
  if (Array.isArray(v)) return 'array';
  if (v && typeof v === 'object') return 'object';
  return 'string';
}

/** Nested page values: `{ name:'site', values:[{name:'title', value:'My shop'}] }` → `{ site: { title: 'My shop' } }`. */
export function pageValuesFromStructures(structs: readonly DynamicDataStructure[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of structs ?? []) {
    if (!s?.name || s.list) continue;
    if (s.values?.length) out[s.name] = rowFromCells(s.values);
    else if (s.value !== undefined) out[s.name] = s.value;
  }
  return out;
}

export interface LegacyOptions {
  /**
   * `client` (default, the previous behavior): the host function returns the WHOLE list and skip/take/sort are applied here.
   * `server`: the function already returns exactly the requested page.
   */
  paging?: 'client' | 'server';
  cacheTtlMs?: number;
}

export function legacyToDefinitions(structs: readonly DynamicDataStructure[], opts: LegacyOptions = {}): DataSourceDefinition[] {
  const defs: DataSourceDefinition[] = [];
  for (const s of structs ?? []) {
    if (!s?.list) continue;
    const id = s.id || s.name;
    const list = s.list;
    const paging = opts.paging ?? 'client';
    defs.push({
      id,
      label: s.displayName || s.name,
      kind: 'collection',
      fields: s.values?.length ? s.values.map(toFieldDefinition) : [],
      params: (s.inputData ?? []).map(toParamDefinition),
      cache: opts.cacheTtlMs ? { ttlMs: opts.cacheTtlMs } : undefined,
      fetch: async (req: NormalizedRequest): Promise<DataResult> => {
        const arg = { take: req.take ?? undefined, skip: req.skip, params: req.params };
        const raw = typeof list === 'function' ? await toPromise(list(arg)) : list;
        let rows = (raw ?? []).map(rowFromCells);
        if (paging === 'server') return { items: rows };
        if (req.sort.length) rows = sortRows(rows, req.sort);
        const total = rows.length;
        return { items: req.take === null ? rows.slice(req.skip) : rows.slice(req.skip, req.skip + req.take), total };
      },
    });
  }
  return defs;
}

function toPromise<T>(v: T | PromiseLike<T> | { subscribe: (o: { next: (x: T) => void; error: (e: unknown) => void }) => unknown }): Promise<T> {
  if (v && typeof (v as { subscribe?: unknown }).subscribe === 'function') {
    return new Promise<T>((resolve, reject) => {
      (v as { subscribe: (o: { next: (x: T) => void; error: (e: unknown) => void }) => unknown }).subscribe({ next: resolve, error: reject });
    });
  }
  return Promise.resolve(v as T | PromiseLike<T>);
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Stable multi-key sort (numbers numerically, text with the locale collator, nulls last). */
export function sortRows(rows: DataRow[], sort: readonly SortSpec[]): DataRow[] {
  const dirs = sort.map((s) => (s.dir === 'desc' ? -1 : 1));
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      for (let k = 0; k < sort.length; k++) {
        const av = a.r[sort[k].field];
        const bv = b.r[sort[k].field];
        const an = av === null || av === undefined;
        const bn = bv === null || bv === undefined;
        if (an || bn) {
          if (an && bn) continue;
          return an ? 1 : -1; // nulls last, whatever the direction
        }
        const c = typeof av === 'number' && typeof bv === 'number' ? av - bv : collator.compare(String(av), String(bv));
        if (c !== 0) return c * dirs[k];
      }
      return a.i - b.i;
    })
    .map((x) => x.r);
}
