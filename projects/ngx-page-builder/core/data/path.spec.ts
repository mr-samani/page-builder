import { describe, expect, it } from 'vitest';
import { getPath, parsePath } from './path';

describe('parsePath', () => {
  it('parses dots, brackets and numeric segments', () => {
    expect(parsePath('a.b.c')).toEqual(['a', 'b', 'c']);
    expect(parsePath('a[0].b')).toEqual(['a', '0', 'b']);
    expect(parsePath('a["x y"].b')).toEqual(['a', 'x y', 'b']);
    expect(parsePath('a.0.b')).toEqual(['a', '0', 'b']);
    expect(parsePath('items[1][2]')).toEqual(['items', '1', '2']);
  });

  it('rejects malformed paths and prototype pollution', () => {
    for (const bad of ['', '.a', 'a..b', 'a[', 'a[]', '__proto__.x', 'a.constructor', 'a.prototype.b', 'a[__proto__]']) {
      expect(parsePath(bad)).toBeNull();
    }
  });

  it('caches results (same array instance)', () => {
    expect(parsePath('x.y.z')).toBe(parsePath('x.y.z'));
  });
});

describe('getPath', () => {
  const data = { a: { b: [{ c: 1 }, { c: 2 }], n: null, 'x y': 5 }, s: 'str', arr: [10, 20, 30] };
  it('reads nested values and array items', () => {
    expect(getPath(data, 'a.b[1].c')).toBe(2);
    expect(getPath(data, 'a.b.0.c')).toBe(1);
    expect(getPath(data, 'a["x y"]')).toBe(5);
    expect(getPath(data, 'arr.length')).toBe(3);
  });
  it('returns undefined instead of throwing', () => {
    expect(getPath(data, 'a.b[5].c')).toBeUndefined();
    expect(getPath(data, 'a.n.deep')).toBeUndefined();
    expect(getPath(data, 's.length')).toBeUndefined(); // strings are not walked
    expect(getPath(null, 'a')).toBeUndefined();
    expect(getPath(data, 'bad..path')).toBeUndefined();
  });
  it('only reads OWN properties (no prototype leakage)', () => {
    expect(getPath({}, 'toString')).toBeUndefined();
    expect(getPath({ a: {} }, 'a.hasOwnProperty')).toBeUndefined();
  });
});
