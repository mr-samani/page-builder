import { describe, expect, it } from 'vitest';
import { collectRequests, distinctReady, usageOfScope, walkItems, type PlanItem } from './plan';

let n = 0;
const item = (o: Partial<PlanItem> & { tag?: string } = {}): PlanItem => ({ id: `i${n++}`, tag: 'div', children: [], ...o }) as PlanItem;
const ds = (id: string, extra: Record<string, unknown> = {}) => ({ id, ...extra }) as PlanItem['dataSource'];

const card = () =>
  item({
    tag: 'div',
    children: [
      item({ tag: 'h3', binding: { content: '{{title}}' } }),
      item({ tag: 'img', dataSource: { binding: 'image' } as never }), // legacy binding
      item({ tag: 'a', binding: { attrs: { href: '/p/{{slug}}' }, showIf: '{{stock}}' } }),
    ],
  });

describe('walkItems', () => {
  it('visits children and templates, tracks owner depth, honours skip', () => {
    const inner = item({ id: 'inner', dataSource: ds('cats'), template: item({ id: 'inner-tpl' }) });
    const outer = item({ id: 'outer', dataSource: ds('products'), template: item({ id: 'outer-tpl', children: [inner] }) });
    const seen: string[] = [];
    const depths: Record<string, number> = {};
    walkItems([outer, item({ id: 'plain', children: [item({ id: 'plain-child' })] })], (i, info) => {
      seen.push(i.id);
      depths[i.id] = info.ownerDepth;
    });
    expect(seen).toEqual(['outer', 'outer-tpl', 'inner', 'inner-tpl', 'plain', 'plain-child']);
    expect(depths).toMatchObject({ outer: 0, 'outer-tpl': 1, inner: 1, 'inner-tpl': 2, plain: 0 });
    const skipped: string[] = [];
    walkItems([outer], (i) => { skipped.push(i.id); return i.id !== 'outer-tpl' ? undefined : false; });
    expect(skipped).toEqual(['outer', 'outer-tpl']);
  });
});

describe('usageOfScope — which fields does the template read?', () => {
  it('unions explicit and legacy bindings', () => {
    const u = usageOfScope([card()]);
    expect([...u.fields].sort()).toEqual(['image', 'slug', 'stock', 'title']);
    expect(u.whole).toBe(false);
  });

  it('a whole-record reference disables projection', () => {
    expect(usageOfScope([item({ binding: { content: '{{row | json}}' } })]).whole).toBe(true);
  });

  it("nested scopes: the nested block's filters and parent.x reads are charged to the OUTER record", () => {
    const nested = item({
      dataSource: ds('reviews', { params: { productId: '@id', owner: '@parent.ownerId' } }),
      template: item({ binding: { content: '{{text}} by {{author}} on {{parent.title}}' } }),
    });
    const u = usageOfScope([item({ binding: { content: '{{name}}' } }), nested]);
    expect([...u.fields].sort()).toEqual(['id', 'name', 'title']); // text/author belong to the inner scope; ownerId is the grand-parent's
  });
});

describe('collectRequests', () => {
  const ctx = { route: { slug: 'red', cat: '12' }, query: { page: '2' } };

  it('plans one request per connected block with the exact fields the template reads', () => {
    const list = item({ id: 'list', dataSource: ds('products', { maxResultCount: 8, pagination: { mode: 'pager' }, params: { cat: '@route.cat' } }), template: card() });
    const [p] = collectRequests([item({ children: [list] })], { ctx });
    expect(p).toMatchObject({ itemId: 'list', source: 'products', mode: 'list', ready: true, dependsOnRow: false, missing: [] });
    expect(p.request).toMatchObject({ skip: 8, take: 8, params: { cat: '12' } });
    expect([...(p.request.fields ?? [])].sort()).toEqual(['id', 'image', 'slug', 'stock', 'title']);
  });

  it('blocks that are not connected are ignored (empty dataSource objects are common)', () => {
    expect(collectRequests([item({ dataSource: ds('', {}) }), item({ dataSource: ds('', { binding: 'x' }) })], { ctx })).toEqual([]);
  });

  it('a details page waits for the route param and is flagged, not requested', () => {
    const detail = item({ dataSource: ds('products', { mode: 'single', params: { slug: '@route.slug' } }), children: [item({ binding: { content: '{{title}}' } })] });
    const ok = collectRequests([detail], { ctx });
    expect(ok[0]).toMatchObject({ mode: 'single', ready: true });
    expect(ok[0].request.params).toEqual({ slug: 'red' });
    const missing = collectRequests([detail], { ctx: { route: {} } });
    expect(missing[0]).toMatchObject({ ready: false, missing: ['slug'] });
    expect(distinctReady(missing)).toEqual([]);
  });

  it('a nested block that depends on the row is deferred; one that does not is prefetchable', () => {
    const byRow = item({ id: 'byRow', dataSource: ds('reviews', { params: { productId: '@id' } }), template: item() });
    const global = item({ id: 'global', dataSource: ds('brands'), template: item() });
    const outer = item({ id: 'outer', dataSource: ds('products'), template: item({ children: [byRow, global] }) });
    const planned = collectRequests([outer], { ctx });
    const by = Object.fromEntries(planned.map((p) => [p.itemId, p]));
    expect(by['outer'].ready).toBe(true);
    expect(by['byRow']).toMatchObject({ dependsOnRow: true, ready: false });
    expect(by['global']).toMatchObject({ dependsOnRow: false, ready: true });
    expect(distinctReady(planned).map((r) => r.source).sort()).toEqual(['brands', 'products']);
  });

  it('identical requests are sent once', () => {
    const a = item({ id: 'a', dataSource: ds('products', { maxResultCount: 4 }), template: item() });
    const b = item({ id: 'b', dataSource: ds('products', { maxResultCount: 4 }), template: item() });
    const c = item({ id: 'c', dataSource: ds('products', { maxResultCount: 5 }), template: item() });
    const planned = collectRequests([a, b, c], { ctx });
    expect(planned).toHaveLength(3);
    expect(distinctReady(planned)).toHaveLength(2);
    expect(planned[0].key).toBe(planned[1].key);
  });

  it('uses the registered definitions (required params, kind, default page size)', () => {
    const list = item({ dataSource: ds('products'), template: item() });
    const defs = (id: string) => (id === 'products' ? { pagination: { defaultTake: 20 }, params: [{ name: 'tenant', required: true }] } : undefined);
    const [p] = collectRequests([list], { ctx, definition: defs });
    expect(p.request.take).toBe(20);
    expect(p).toMatchObject({ ready: false, missing: ['tenant'] });
  });
});
