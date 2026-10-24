import { describe, expect, it } from 'vitest';
import { paramsDependOnRow, resolveParams } from './params';
import { createScope } from './scope';

const parent = createScope({}, { id: 7, name: 'Shoes' });
const scope = createScope({ route: { slug: 'red', cat: '12' }, query: { page: '3', q: '', tag: ['a', 'b'] }, global: { tenant: 't1' } }, { categoryId: 9 }, parent);

describe('resolveParams', () => {
  it('returns literals untouched', () => {
    expect(resolveParams({ a: 'x', b: 5, c: true, d: ['y'] }, scope).values).toEqual({ a: 'x', b: 5, c: true, d: ['y'] });
  });

  it('resolves typed @references from every scope', () => {
    const r = resolveParams({ slug: '@route.slug', page: '@query.page', tags: '@query.tag', tenant: '@global.tenant', cat: '@categoryId', pid: '@parent.id' }, scope);
    expect(r.values).toEqual({ slug: 'red', page: '3', tags: ['a', 'b'], tenant: 't1', cat: 9, pid: 7 });
    expect(r.unresolved).toEqual([]);
  });

  it('reports references that resolved to nothing, and omits them', () => {
    const r = resolveParams({ q: '@query.q', nope: '@route.nope', slug: '@route.slug' }, scope);
    expect(r.values).toEqual({ slug: 'red' });
    expect(r.unresolved.sort()).toEqual(['nope', 'q']);
  });

  it('supports templates and the @@ escape', () => {
    const r = resolveParams({ s: 'cat-{{route.slug}}', empty: '{{route.nope}}', email: '@@home', mid: 'a@b' }, scope);
    expect(r.values).toEqual({ s: 'cat-red', email: '@home', mid: 'a@b' });
    expect(r.unresolved).toEqual(['empty']);
  });

  it('resolves nested objects and arrays', () => {
    const r = resolveParams({ filter: { cat: '@route.cat', in: ['@route.slug', 'fixed'] } }, scope);
    expect(r.values).toEqual({ filter: { cat: '12', in: ['red', 'fixed'] } });
  });

  it('handles empty input', () => {
    expect(resolveParams(undefined, scope)).toEqual({ values: {}, unresolved: [] });
  });
});

describe('paramsDependOnRow', () => {
  it('detects row / parent / loop references', () => {
    expect(paramsDependOnRow({ a: '@parent.id' })).toBe(true);
    expect(paramsDependOnRow({ a: '@row.categoryId' })).toBe(true);
    expect(paramsDependOnRow({ a: '@id' })).toBe(true); // a bare @field is a field of the current record
    expect(paramsDependOnRow({ a: 'x-{{parent.id}}' })).toBe(true);
    expect(paramsDependOnRow({ a: '{{categoryId}}' })).toBe(true);
    expect(paramsDependOnRow({ a: { b: ['@parent.id'] } })).toBe(true);
  });
  it('is false for route / query / global / literals', () => {
    expect(paramsDependOnRow({ a: '@route.slug', b: 'x', c: '@@parent.id', d: '{{query.p}}', e: '@global.t', f: '@page.x' })).toBe(false);
    expect(paramsDependOnRow(undefined)).toBe(false);
  });
});
