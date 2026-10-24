import { describe, expect, it } from 'vitest';
import { DataSourceSetting } from '../models/DataSourceSetting';
import { createScope } from './scope';
import { resolveSettingRequest } from './setting';
import type { DataContext } from './types';

const S = (o: Partial<DataSourceSetting>) => Object.assign(new DataSourceSetting(), { id: 'products' }, o);
const scope = (ctx: DataContext = {}, row?: Record<string, unknown>, parent?: Record<string, unknown>) =>
  createScope(ctx, row, parent ? createScope(ctx, parent) : undefined);

describe('resolveSettingRequest', () => {
  it('builds a plain request with defaults', () => {
    const r = resolveSettingRequest(S({ maxResultCount: 12 }), scope());
    expect(r.request).toMatchObject({ source: 'products', skip: 0, take: 12, mode: 'list', params: {} });
    expect(r).toMatchObject({ page: 1, take: 12, mode: 'list', missing: [], dependsOnRow: false });
  });

  it('pager: skip comes from ?page= and sanitizes garbage', () => {
    const s = S({ maxResultCount: 10, pagination: { mode: 'pager' } });
    expect(resolveSettingRequest(s, scope({ query: { page: '3' } })).request.skip).toBe(20);
    expect(resolveSettingRequest(s, scope({ query: { page: '3' } })).page).toBe(3);
    expect(resolveSettingRequest(s, scope({ query: { page: '-4' } })).request.skip).toBe(0);
    expect(resolveSettingRequest(s, scope({ query: { page: 'abc' } })).request.skip).toBe(0);
    expect(resolveSettingRequest(s, scope({ query: { page: ['2', '9'] } })).request.skip).toBe(10);
    expect(resolveSettingRequest(S({ ...s, pagination: { mode: 'pager', pageParam: 'p' } }), scope({ query: { p: '2' } })).request.skip).toBe(10);
  });

  it('skipCount is the base offset for every paging mode', () => {
    const s = S({ maxResultCount: 5, skipCount: 3, pagination: { mode: 'pager' } });
    expect(resolveSettingRequest(s, scope({ query: { page: '2' } })).request.skip).toBe(8);
  });

  it('loadMore / infinite continue after what is already shown', () => {
    const s = S({ maxResultCount: 6, pagination: { mode: 'loadMore' } });
    expect(resolveSettingRequest(s, scope(), { loaded: 12 }).request.skip).toBe(12);
    expect(resolveSettingRequest(S({ ...s, pagination: { mode: 'infinite' } }), scope()).request.skip).toBe(0);
  });

  it('single mode: one record, no offset', () => {
    const r = resolveSettingRequest(S({ mode: 'single', skipCount: 9, maxResultCount: 50, params: { slug: '@route.slug' } }), scope({ route: { slug: 'red' } }));
    expect(r.request).toMatchObject({ mode: 'single', take: 1, skip: 0, params: { slug: 'red' } });
  });

  it('a route-bound param without a value is "missing": the page is not valid, nothing to fetch', () => {
    const r = resolveSettingRequest(S({ mode: 'single', params: { slug: '@route.slug' } }), scope({ route: {} }));
    expect(r.missing).toEqual(['slug']);
    expect(resolveSettingRequest(S({ params: { q: '@query.q' } }), scope({ query: {} })).missing).toEqual([]); // an empty filter is fine
  });

  it('required params of the definition are enforced; defaults are applied', () => {
    const def = { params: [{ name: 'cat', required: true }, { name: 'lang', defaultValue: 'fa' }] };
    expect(resolveSettingRequest(S({}), scope(), { def }).missing).toEqual(['cat']);
    const ok = resolveSettingRequest(S({ params: { cat: 'x' } }), scope(), { def });
    expect(ok.missing).toEqual([]);
    expect(ok.request.params).toEqual({ cat: 'x', lang: 'fa' });
  });

  it('resolves params from route, query, row and parent', () => {
    const r = resolveSettingRequest(
      S({ params: { cat: '@route.cat', page: '@query.p', owner: '@parent.id', mine: '@categoryId', lit: 'x' } }),
      scope({ route: { cat: 'shoes' }, query: { p: '2' } }, { categoryId: 9 }, { id: 7 }),
    );
    expect(r.request.params).toEqual({ cat: 'shoes', page: '2', owner: 7, mine: 9, lit: 'x' });
    expect(r.dependsOnRow).toBe(true);
  });

  it('search is resolved from references', () => {
    expect(resolveSettingRequest(S({ search: '@query.q' }), scope({ query: { q: 'کفش' } })).request.search).toBe('کفش');
    expect(resolveSettingRequest(S({ search: '@query.q' }), scope({ query: {} })).request.search).toBeNull();
  });

  describe('sort from the URL', () => {
    const fields = [{ name: 'price', sortable: true }, { name: 'title' }, { name: 'secret', sortable: false }];
    const s = S({ sortParam: 'sort', sort: [{ field: 'title', dir: 'asc' }] });
    it('accepts allowed fields, defaults the direction to asc', () => {
      expect(resolveSettingRequest(s, scope({ query: { sort: 'price:desc' } }), { def: { fields } }).request.sort).toEqual([{ field: 'price', dir: 'desc' }]);
      expect(resolveSettingRequest(s, scope({ query: { sort: 'price' } }), { def: { fields } }).request.sort).toEqual([{ field: 'price', dir: 'asc' }]);
    });
    it('ignores fields that are not sortable (sortable:true acts as the whitelist) and malformed values', () => {
      for (const bad of ['title:desc', 'secret', 'price;drop table', 'a:b:c', '']) {
        expect(resolveSettingRequest(s, scope({ query: { sort: bad } }), { def: { fields } }).request.sort).toEqual([{ field: 'title', dir: 'asc' }]);
      }
    });
    it('without a schema it passes a well-formed field to the backend (which validates)', () => {
      expect(resolveSettingRequest(s, scope({ query: { sort: 'anything:desc' } })).request.sort).toEqual([{ field: 'anything', dir: 'desc' }]);
    });
  });

  it('projection always includes the key field and can be switched off', () => {
    expect(resolveSettingRequest(S({}), scope(), { fields: ['title', 'price'] }).request.fields).toEqual(['title', 'price', 'id']);
    expect(resolveSettingRequest(S({ keyField: 'sku' }), scope(), { fields: ['title'] }).request.fields).toEqual(['title', 'sku']);
    expect(resolveSettingRequest(S({ projectFields: false }), scope(), { fields: ['title'] }).request.fields).toBeUndefined();
    expect(resolveSettingRequest(S({}), scope(), { fields: [] }).request.fields).toEqual([]); // template uses no field → nothing besides counts
  });

  it('the definition provides take defaults and kind', () => {
    expect(resolveSettingRequest(S({}), scope(), { def: { pagination: { defaultTake: 24 } } }).take).toBe(24);
    expect(resolveSettingRequest(S({}), scope(), { def: { kind: 'record' } }).mode).toBe('single');
  });
});
