import { describe, expect, it } from 'vitest';
import { keyOf, normalizeRequest, requestKey } from './request';

describe('normalizeRequest', () => {
  it('fills defaults', () => {
    expect(normalizeRequest({ source: 'products' })).toEqual({
      source: 'products', skip: 0, take: null, sort: [], params: {}, fields: [], search: null, mode: 'list', cursor: null,
    });
  });

  it('uses the definition: default take, max take, record → single', () => {
    expect(normalizeRequest({ source: 'p' }, { pagination: { defaultTake: 12 } }).take).toBe(12);
    expect(normalizeRequest({ source: 'p', take: 500 }, { pagination: { maxTake: 50 } }).take).toBe(50);
    const rec = normalizeRequest({ source: 'p', skip: 9 }, { kind: 'record' });
    expect(rec).toMatchObject({ mode: 'single', take: 1, skip: 0 });
  });

  it('sanitizes numbers', () => {
    const n = normalizeRequest({ source: 'p', skip: -5, take: '8' as unknown as number });
    expect(n.skip).toBe(0);
    expect(n.take).toBe(8);
    expect(normalizeRequest({ source: 'p', take: 0 }).take).toBeNull();
    expect(normalizeRequest({ source: 'p', skip: 'x' as unknown as number }).skip).toBe(0);
    expect(normalizeRequest({ source: 'p', skip: 2.9 }).skip).toBe(2);
  });

  it('removes empty params so "no filter" has ONE cache entry', () => {
    const a = normalizeRequest({ source: 'p', params: { q: '', cat: null, tag: [], x: undefined, ok: 0, f: false } });
    expect(a.params).toEqual({ ok: 0, f: false });
    expect(requestKey(a)).toBe(keyOf({ source: 'p', params: { ok: 0, f: false } }));
  });

  it('dedupes + normalizes sort, sorts + dedupes fields, trims search', () => {
    const n = normalizeRequest({
      source: 'p',
      sort: [{ field: 'price', dir: 'desc' }, { field: 'price', dir: 'asc' }, { field: '', dir: 'asc' }, { field: 'name', dir: 'weird' as 'asc' }],
      fields: ['title', 'id', 'title', ''],
      search: '  shoes  ',
    });
    expect(n.sort).toEqual([{ field: 'price', dir: 'desc' }, { field: 'name', dir: 'asc' }]);
    expect(n.fields).toEqual(['id', 'title']);
    expect(n.search).toBe('shoes');
    expect(normalizeRequest({ source: 'p', search: '   ' }).search).toBeNull();
  });
});

describe('requestKey', () => {
  it('is independent of param key order and field order', () => {
    expect(keyOf({ source: 's', params: { a: 1, b: { y: 1, x: 2 } }, fields: ['b', 'a'] })).toBe(
      keyOf({ source: 's', params: { b: { x: 2, y: 1 }, a: 1 }, fields: ['a', 'b'] }),
    );
  });

  it('changes when anything meaningful changes', () => {
    const base = keyOf({ source: 's', skip: 0, take: 10 });
    expect(keyOf({ source: 's', skip: 10, take: 10 })).not.toBe(base);
    expect(keyOf({ source: 's', take: 11 })).not.toBe(base);
    expect(keyOf({ source: 's2', take: 10 })).not.toBe(base);
    expect(keyOf({ source: 's', take: 10, search: 'x' })).not.toBe(base);
    expect(keyOf({ source: 's', take: 10, cursor: 'abc' })).not.toBe(base);
    expect(keyOf({ source: 's', take: 10, sort: [{ field: 'a', dir: 'desc' }] })).not.toBe(base);
  });

  it('has a FIXED, documented shape (the .NET side reproduces it byte for byte)', () => {
    expect(
      keyOf({ source: 'products', skip: 12, take: 12, sort: [{ field: 'price', dir: 'desc' }], params: { category: 'shoes', tags: ['a', 'b'] }, fields: ['title', 'id'], search: 'سلام' }),
    ).toBe(
      '{"source":"products","skip":12,"take":12,"sort":[{"dir":"desc","field":"price"}],"params":{"category":"shoes","tags":["a","b"]},"fields":["id","title"],"search":"سلام","mode":"list","cursor":null}',
    );
  });
});
