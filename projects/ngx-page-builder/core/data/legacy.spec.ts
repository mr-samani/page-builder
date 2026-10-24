import { describe, expect, it } from 'vitest';
import { DynamicDataInputType, DynamicValueType, type DynamicDataStructure } from '../models/DynamicData';
import { fieldsToStructures, inferFields, legacyToDefinitions, pageValuesFromStructures, rowFromCells, sortRows } from './legacy';
import { DataStore } from './store';

const cell = (name: string, value: unknown, type = DynamicValueType.String): DynamicDataStructure => ({ name, displayName: name.toUpperCase(), type, value: value as never });
const legacyRows = (n: number): DynamicDataStructure[][] => Array.from({ length: n }, (_, i) => [cell('id', i, DynamicValueType.Int), cell('title', `P${i}`), cell('price', 100 - i, DynamicValueType.Int)]);

describe('rowFromCells', () => {
  it('flattens name/value cells to a plain row, including nested values and lists', () => {
    const row = rowFromCells([
      cell('id', 1),
      { name: 'seller', displayName: 'S', type: DynamicValueType.Object, values: [cell('name', 'Ali')] },
      { name: 'tags', displayName: 'T', type: DynamicValueType.Array, list: [[cell('t', 'a')], [cell('t', 'b')]] },
      cell('none', undefined),
    ]);
    expect(row).toEqual({ id: 1, seller: { name: 'Ali' }, tags: [{ t: 'a' }, { t: 'b' }], none: null });
  });
  it('ignores nameless cells', () => {
    expect(rowFromCells([{ displayName: 'x', type: 0 } as never, cell('a', 1)])).toEqual({ a: 1 });
  });
});

describe('legacyToDefinitions', () => {
  const structs: DynamicDataStructure[] = [
    {
      id: 'products', name: 'products', displayName: 'Products', type: DynamicValueType.Array,
      values: [cell('title', ''), cell('price', 0, DynamicValueType.Int)],
      inputData: [{ name: 'cat', label: 'Category', type: DynamicDataInputType.Select, options: [{ id: 1, title: 'Shoes' }] }],
      list: () => Promise.resolve(legacyRows(30)),
    },
    { name: 'site', displayName: 'Site', type: DynamicValueType.Object, values: [cell('title', 'My shop')] },
  ];

  it('builds a definition with fields and typed params', () => {
    const [d] = legacyToDefinitions(structs);
    expect(d).toMatchObject({ id: 'products', label: 'Products', kind: 'collection' });
    expect(d.fields).toEqual([{ name: 'title', label: 'TITLE', type: 'string' }, { name: 'price', label: 'PRICE', type: 'number' }]);
    expect(d.params).toEqual([{ name: 'cat', label: 'Category', type: 'select', options: [{ id: 1, title: 'Shoes' }], defaultValue: undefined }]);
  });

  it('client paging (default) slices the full list ONCE — the old code sliced twice and returned nothing for page 2', async () => {
    const store = new DataStore().register(legacyToDefinitions(structs));
    const p1 = await store.load({ source: 'products', skip: 0, take: 12 });
    const p2 = await store.load({ source: 'products', skip: 12, take: 12 });
    const p3 = await store.load({ source: 'products', skip: 24, take: 12 });
    expect([p1.items.length, p2.items.length, p3.items.length]).toEqual([12, 12, 6]);
    expect(p2.items[0]).toMatchObject({ id: 12 });
    expect(p3.total).toBe(30);
  });

  it('server paging trusts the host function', async () => {
    const calls: unknown[] = [];
    const store = new DataStore().register(
      legacyToDefinitions([{ name: 's', displayName: 's', type: 0, list: (a: unknown) => { calls.push(a); return Promise.resolve(legacyRows(12)); } } as never], { paging: 'server' }),
    );
    const r = await store.load({ source: 's', skip: 24, take: 12, params: { cat: 3 } });
    expect(r.items).toHaveLength(12);
    expect(calls).toEqual([{ take: 12, skip: 24, params: { cat: 3 } }]);
  });

  it('sorts client-side when the host cannot', async () => {
    const store = new DataStore().register(legacyToDefinitions(structs));
    const r = await store.load({ source: 'products', take: 3, sort: [{ field: 'price', dir: 'asc' }] });
    expect(r.items.map((x) => x['price'])).toEqual([71, 72, 73]);
  });

  it('accepts static arrays and observables', async () => {
    const store = new DataStore().register(
      legacyToDefinitions([
        { name: 'a', displayName: 'a', type: 0, list: legacyRows(2) },
        { name: 'b', displayName: 'b', type: 0, list: () => ({ subscribe: (o: { next: (v: unknown) => void }) => o.next(legacyRows(3)) }) },
      ] as never),
    );
    expect((await store.load({ source: 'a' })).items).toHaveLength(2);
    expect((await store.load({ source: 'b' })).items).toHaveLength(3);
  });
});

describe('pageValuesFromStructures', () => {
  it('builds the nested page scope and skips lists', () => {
    expect(
      pageValuesFromStructures([
        { name: 'site', displayName: 's', type: 7, values: [cell('title', 'My shop'), { name: 'owner', displayName: 'o', type: 7, values: [cell('name', 'Sara')] }] },
        { name: 'year', displayName: 'y', type: 1, value: 2026 },
        { name: 'lst', displayName: 'l', type: 6, list: [] },
      ]),
    ).toEqual({ site: { title: 'My shop', owner: { name: 'Sara' } }, year: 2026 });
  });
});

describe('inferFields / fieldsToStructures', () => {
  it('infers types from sample rows', () => {
    expect(inferFields([{ id: 1, title: 'x', ok: true, d: new Date(), tags: [], o: {} }, { id: 2, title: null }]).map((f) => `${f.name}:${f.type}`)).toEqual(['id:number', 'title:string', 'ok:boolean', 'd:datetime', 'tags:array', 'o:object']);
  });
  it('converts schema fields back to the structure shape the old UI expects', () => {
    const s = fieldsToStructures([{ name: 'price', label: 'Price', type: 'number' }, { name: 'seller', type: 'object', fields: [{ name: 'n' }] }]);
    expect(s[0]).toMatchObject({ name: 'price', displayName: 'Price', type: DynamicValueType.Int });
    expect(s[1].values?.[0].name).toBe('n');
  });
});

describe('sortRows', () => {
  const rows = [{ n: 10, s: 'b' }, { n: 2, s: 'a' }, { n: null, s: 'c' }, { n: 2, s: 'z' }];
  it('sorts numbers numerically, nulls last in both directions, stable', () => {
    expect(sortRows(rows, [{ field: 'n', dir: 'asc' }]).map((r) => r.s)).toEqual(['a', 'z', 'b', 'c']);
    expect(sortRows(rows, [{ field: 'n', dir: 'desc' }]).map((r) => r.s)).toEqual(['b', 'a', 'z', 'c']);
  });
  it('supports multiple keys and natural text order', () => {
    expect(sortRows(rows, [{ field: 'n', dir: 'asc' }, { field: 's', dir: 'desc' }]).map((r) => r.s)).toEqual(['z', 'a', 'b', 'c']);
    expect(sortRows([{ s: 'item10' }, { s: 'item2' }], [{ field: 's', dir: 'asc' }]).map((r) => r.s)).toEqual(['item2', 'item10']);
  });
});
