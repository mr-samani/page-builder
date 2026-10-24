import { describe, expect, it, vi } from 'vitest';
import { DataStore } from '../data/store';
import { createScope } from '../data/scope';
import { Repeater } from './repeater';
import { buildRowPlan, bindRowOnce, type RenderedItem } from './row-plan';
import { CollectionController, type CollectionHost, type CollectionState } from './collection-controller';
import { RecordScope } from './record-scope';
import { findScope } from './scope-registry';

/** a rendered template: <article><h3/><a><img/></a></article> with bindings, items carry their elements like PageItem.el */
function template(): { root: RenderedItem; el: HTMLElement } {
  const el = document.createElement('article');
  el.innerHTML = '<h3></h3><a><img></a>';
  const h3 = el.children[0] as HTMLElement;
  const a = el.children[1] as HTMLElement;
  const img = a.children[0] as HTMLElement;
  const root: RenderedItem = {
    id: 'card', tag: 'article', el, children: [
      { id: 'title', tag: 'h3', el: h3, binding: { content: '{{title}} #{{$number}}' } },
      { id: 'link', tag: 'a', el: a, binding: { attrs: { href: '/p/{{slug}}' } }, children: [{ id: 'img', tag: 'img', el: img, binding: { attrs: { src: '{{image}}', alt: '{{title}}' } } }] },
    ],
  };
  return { root, el };
}
const rows = (n: number, from = 0) => Array.from({ length: n }, (_, i) => ({ id: from + i, title: `P${from + i}`, slug: `p-${from + i}`, image: `/i${from + i}.png` }));
const ctx = () => ({});

function make(extra: Partial<ConstructorParameters<typeof Repeater>[0]> = {}) {
  const { root, el } = template();
  const container = document.createElement('div');
  const plan = buildRowPlan(root, el);
  const r = new Repeater({ container, prototype: el, plan, getContext: ctx, keyField: 'id', ...extra });
  return { r, container, plan, el };
}

describe('buildRowPlan', () => {
  it('records bound nodes by path and says the template is cloneable', () => {
    const { plan } = make();
    expect(plan.cloneable).toBe(true);
    expect(plan.nodes.map((n) => [n.itemId, n.path])).toEqual([['title', [0]], ['link', [1]], ['img', [1, 0]]]);
    expect(plan.usesLoop).toBe(true);
  });
  it('a nested collection or custom component makes it non-cloneable', () => {
    const { root, el } = template();
    root.children![0].dataSource = { id: 'reviews' };
    expect(buildRowPlan(root, el).cloneable).toBe(false);
    const t2 = template();
    t2.root.children![1].customComponent = {};
    expect(buildRowPlan(t2.root, t2.el).cloneable).toBe(false);
  });
});

describe('Repeater', () => {
  it('renders rows as clones with bindings applied and the prototype untouched', async () => {
    const { r, container, el } = make();
    await r.render(rows(3));
    expect(container.children).toHaveLength(3);
    const c = container.children[1];
    expect(c.querySelector('h3')!.textContent).toBe('P1 #2');
    expect(c.querySelector('a')!.getAttribute('href')).toBe('/p/p-1');
    expect(c.querySelector('img')!.getAttribute('src')).toBe('/i1.png');
    expect(el.querySelector('h3')!.textContent).toBe('');
  });

  it('each row keeps ITS OWN values (the old shared-options bug made all images equal)', async () => {
    const { r, container } = make();
    await r.render(rows(5));
    expect([...container.querySelectorAll('img')].map((i) => i.getAttribute('src'))).toEqual(['/i0.png', '/i1.png', '/i2.png', '/i3.png', '/i4.png']);
  });

  it('reuses DOM by key, moves rows and removes the rest', async () => {
    const { r, container } = make();
    await r.render(rows(4));
    const before = [...container.children];
    await r.render([rows(4)[2], rows(4)[0], { id: 9, title: 'New', slug: 'n', image: '/n.png' }]);
    const after = [...container.children];
    expect(after[0]).toBe(before[2]);
    expect(after[1]).toBe(before[0]);
    expect(after).toHaveLength(3);
    expect(after[2].querySelector('h3')!.textContent).toBe('New #3');
    expect(before[1].isConnected).toBe(false);
  });

  it('updates values of a reused row in place and writes only what changed', async () => {
    const { r, container } = make();
    await r.render([rows(1)[0]]);
    const h3 = container.querySelector('h3')!;
    const recs: MutationRecord[] = [];
    const mo = new MutationObserver((list) => recs.push(...list));
    mo.observe(container, { subtree: true, childList: true, attributes: true, characterData: true });
    await r.render([{ ...rows(1)[0], title: 'Changed' }]);
    await Promise.resolve();
    expect(h3.textContent).toBe('Changed #1');
    expect(recs.some((x) => x.type === 'attributes')).toBe(true); // alt changed with the title
    expect(recs.every((x) => x.type !== 'childList' || x.target === h3)).toBe(true); // no row was rebuilt
  });

  it('appends (load more) without touching earlier rows, and re-numbers only when $-variables are used', async () => {
    const { r, container } = make();
    await r.render(rows(2));
    const first = container.children[0];
    await r.render(rows(2, 2), { append: true });
    expect(container.children).toHaveLength(4);
    expect(container.children[0]).toBe(first);
    expect(container.children[3].querySelector('h3')!.textContent).toBe('P3 #4');
  });

  it('keeps rows after an anchor (status elements live before the rows)', async () => {
    const container = document.createElement('div');
    const status = document.createElement('p');
    container.appendChild(status);
    const { root, el } = template();
    const r = new Repeater({ container, anchor: status, prototype: el, plan: buildRowPlan(root, el), getContext: ctx });
    await r.render(rows(2));
    expect(container.firstElementChild).toBe(status);
    expect(container.children).toHaveLength(3);
    await r.render(rows(1));
    expect(container.children).toHaveLength(2);
  });

  it('registers the row scope so nested blocks can find their record', async () => {
    const { r, container } = make();
    await r.render(rows(2));
    const s = findScope(container.children[1].querySelector('img'))!;
    expect(s.row).toMatchObject({ id: 1 });
    expect([s.index, s.count]).toEqual([1, 2]);
  });

  it('rowOf maps any descendant back to its record (designer: click a clone → select the prototype node)', async () => {
    const { r, container } = make();
    await r.render(rows(3));
    expect(r.rowOf(container.children[2].querySelector('img'))).toMatchObject({ index: 2, row: { id: 2 } });
    expect(r.rowOf(document.body)).toBeUndefined();
  });

  it('decorate runs on every fresh clone', async () => {
    const decorate = vi.fn((el: Element) => el.setAttribute('inert', ''));
    const { r, container } = make({ decorate });
    await r.render(rows(3));
    expect(decorate).toHaveBeenCalledTimes(3);
    expect(container.children[0].hasAttribute('inert')).toBe(true);
  });

  it('renders big lists progressively and a newer render cancels the old slices', async () => {
    const queue: (() => void)[] = [];
    const scheduler = { schedule: (fn: () => void) => { queue.push(fn); return () => { const i = queue.indexOf(fn); if (i >= 0) queue.splice(i, 1); }; } };
    const { r, container } = make({ scheduler, chunkSize: 10, progressiveThreshold: 25 });
    const p = r.render(rows(100));
    expect(container.children).toHaveLength(10); // first slice is synchronous
    while (queue.length) queue.shift()!();
    await p;
    expect(container.children).toHaveLength(100);

    const p2 = r.render(rows(100, 1000));
    queue.shift()!();
    const p3 = r.render(rows(3, 5000)); // supersedes
    queue.length = 0;
    await Promise.all([p2, p3]);
    expect(container.children).toHaveLength(3);
  });

  it('survives 2000 rows quickly (clone + patch, no block pipeline)', async () => {
    const { r, container } = make();
    const t0 = performance.now();
    await r.render(rows(2000));
    const ms = performance.now() - t0;
    console.log(`        2000 rows rendered in ${ms.toFixed(0)} ms`);
    expect(container.children).toHaveLength(2000);
    expect(ms).toBeLessThan(2500);
  });

  it('non-cloneable templates use createRow, in order, and are cancellable', async () => {
    const { root, el } = template();
    root.customComponent = {};
    const plan = buildRowPlan(root, el);
    const container = document.createElement('div');
    const createRow = vi.fn(async (row: Record<string, unknown>) => { const e = document.createElement('li'); e.textContent = String(row['title']); return e; });
    const r = new Repeater({ container, prototype: el, plan, getContext: ctx, createRow });
    await r.render(rows(3));
    expect([...container.children].map((c) => c.textContent)).toEqual(['P0', 'P1', 'P2']);
    await expect(new Repeater({ container, prototype: el, plan, getContext: ctx }).render(rows(1))).rejects.toThrow(/createRow/);
  });

  it('destroy / clear remove the rows', async () => {
    const { r, container } = make();
    await r.render(rows(3));
    r.clear();
    expect(container.children).toHaveLength(0);
    await r.render(rows(2));
    r.destroy();
    expect(container.children).toHaveLength(0);
    await r.render(rows(2)); // ignored after destroy
    expect(container.children).toHaveLength(0);
  });
});

describe('bindRowOnce', () => {
  it('binds a rendered element by plan', () => {
    const { root, el } = template();
    bindRowOnce(el, buildRowPlan(root, el), createScope({}, rows(1)[0]));
    expect(el.querySelector('img')!.getAttribute('alt')).toBe('P0');
  });
});

//==================================================================================

function harness(items: ReturnType<typeof rows>, opts: { total?: number; take?: number; pagination?: 'pager' | 'loadMore' } = {}) {
  const store = new DataStore();
  const fetch = vi.fn(async (req: { skip: number; take: number | null }) => ({ items: items.slice(req.skip, req.take ? req.skip + req.take : undefined), total: opts.total ?? items.length }));
  store.register({ id: 'products', fetch: fetch as never });
  const calls: { rows: number; append: boolean; status: string }[] = [];
  const states: string[] = [];
  const host: CollectionHost = { render: (r, i) => { calls.push({ rows: r.length, append: i.append, status: i.state.status }); }, onState: (s: CollectionState) => states.push(s.status) };
  let context: Record<string, unknown> = { query: {}, route: {} };
  const notFound = vi.fn();
  const c = new CollectionController({ store, getContext: () => ({ ...context, onNotFound: notFound, navigate: vi.fn() }) as never, host });
  const owner = { id: 'o', dataSource: { id: 'products', maxResultCount: opts.take ?? 4, pagination: opts.pagination ? { mode: opts.pagination } : undefined, params: {} } as never, template: { id: 't', children: [{ id: 'h', binding: { content: '{{title}}' } }] } } as never;
  c.bind(owner);
  return { c, store, fetch, calls, states, setContext: (x: Record<string, unknown>) => (context = x), notFound };
}

describe('CollectionController', () => {
  it('loads, renders and reports state; asks the server for the template fields only', async () => {
    const h = harness(rows(10));
    await h.c.refresh();
    expect(h.c.state).toMatchObject({ status: 'ready', loaded: 4, total: 10, hasRows: true });
    expect(h.calls).toEqual([{ rows: 4, append: false, status: 'ready' }]);
    expect(h.states).toEqual(['loading', 'ready']);
    expect((h.fetch.mock.calls[0][0] as never as { fields: string[] }).fields).toEqual(['id', 'title']);
  });

  it('an unchanged request is a no-op; a changed one reloads; the previous request is cancelled', async () => {
    const h = harness(rows(30), { pagination: 'pager' });
    await h.c.refresh();
    await h.c.refresh();
    expect(h.fetch).toHaveBeenCalledTimes(1);
    h.setContext({ query: { page: '2' } });
    await h.c.refresh();
    expect(h.fetch).toHaveBeenCalledTimes(2);
    expect(h.c.state).toMatchObject({ page: 2, pageCount: 8 });
  });

  it('a slow stale answer never overwrites a newer one', async () => {
    const store = new DataStore();
    const resolvers: Record<string, (v: unknown) => void> = {};
    store.register({ id: 'products', fetch: ((req: { skip: number }) => new Promise((res) => { resolvers[String(req.skip)] = res; })) as never });
    const shown: number[] = [];
    let ctxv = { query: { page: '1' } } as Record<string, unknown>;
    const c = new CollectionController({ store, getContext: () => ctxv as never, host: { render: (r) => { shown.push(r.length); } } });
    c.bind({ id: 'o', dataSource: { id: 'products', maxResultCount: 2, pagination: { mode: 'pager' } } as never, template: { id: 't' } as never });
    const p1 = c.refresh();
    await Promise.resolve();
    ctxv = { query: { page: '2' } };
    const p2 = c.refresh();
    await new Promise((r) => setTimeout(r, 5));
    resolvers['2']?.({ items: rows(2, 2) });
    resolvers['0']?.({ items: rows(1) }); // page 1 answers LATE with a different size
    await Promise.all([p1.catch(() => undefined), p2]);
    expect(shown).toEqual([2]);
  });

  it('empty and error states; errors are retried', async () => {
    const store = new DataStore({ retries: 0 });
    let fail = true;
    store.register({ id: 'products', fetch: (async () => { if (fail) throw new TypeError('x'); return { items: [] }; }) as never });
    const c = new CollectionController({ store, getContext: () => ({}) as never, host: { render: () => undefined } });
    c.bind({ id: 'o', dataSource: { id: 'products' } as never, template: { id: 't' } as never });
    await c.refresh();
    expect(c.state).toMatchObject({ status: 'error', error: { code: 'network' } });
    fail = false;
    await c.retry();
    expect(c.state.status).toBe('empty');
  });

  it('waits (idle) while a required route value is missing — no request is sent', async () => {
    const store = new DataStore();
    const fetch = vi.fn(async () => ({ items: [] }));
    store.register({ id: 'products', fetch: fetch as never });
    const c = new CollectionController({ store, getContext: () => ({ route: {} }) as never, host: { render: () => undefined } });
    c.bind({ id: 'o', dataSource: { id: 'products', mode: 'single', params: { slug: '@route.slug' } } as never, template: { id: 't' } as never });
    await c.refresh();
    expect(c.state).toMatchObject({ status: 'idle', waitingFor: ['slug'] });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('single mode: a missing record is "notfound" and the host is told (HTTP 404 on the server)', async () => {
    const h = harness([]);
    h.c.bind({ id: 'o', dataSource: { id: 'products', mode: 'single', params: {} } as never, template: { id: 't' } as never });
    await h.c.refresh();
    expect(h.c.state.status).toBe('notfound');
    expect(h.notFound).toHaveBeenCalledWith({ source: 'products' });
  });

  it('load more appends and knows when the end is reached (known total)', async () => {
    const h = harness(rows(10), { pagination: 'loadMore', take: 4 });
    await h.c.refresh();
    expect(h.c.state.hasMore).toBe(true);
    await h.c.loadMore();
    await h.c.loadMore();
    expect(h.calls.map((x) => [x.rows, x.append])).toEqual([[4, false], [4, true], [2, true]]);
    expect(h.c.state).toMatchObject({ loaded: 10, hasMore: false });
    await h.c.loadMore(); // nothing left → no request
    expect(h.fetch).toHaveBeenCalledTimes(3);
  });

  it('a failing "load more" keeps the rows and can be retried', async () => {
    const h = harness(rows(10), { pagination: 'loadMore', take: 4 });
    await h.c.refresh();
    h.store.unregister('products');
    h.store.register({ id: 'products', fetch: (async () => { throw Object.assign(new Error('x'), { status: 404 }); }) as never });
    await h.c.loadMore();
    expect(h.c.state).toMatchObject({ status: 'ready', moreFailed: true, loaded: 4 });
  });

  it('pager navigation goes through the URL', () => {
    const navigate = vi.fn();
    const store = new DataStore();
    const c = new CollectionController({ store, getContext: () => ({ navigate }) as never, host: { render: () => undefined } });
    c.bind({ id: 'o', dataSource: { id: 'x', pagination: { mode: 'pager', pageParam: 'p' } } as never, template: { id: 't' } as never });
    expect(c.goToPage(3)).toBe(true);
    expect(navigate).toHaveBeenCalledWith({ p: '3' });
    c.goToPage(1);
    expect(navigate).toHaveBeenLastCalledWith({ p: null });
  });

  it('an unconnected block is idle', async () => {
    const h = harness(rows(1));
    h.c.bind({ id: 'o', dataSource: { id: '' } as never, template: { id: 't' } as never });
    await h.c.refresh();
    expect(h.c.state.status).toBe('idle');
  });
});

describe('RecordScope', () => {
  it('binds the descendants of a wrapper to the loaded record and exposes the scope to nested blocks', async () => {
    const wrapper = document.createElement('section');
    wrapper.innerHTML = '<h1></h1><p></p>';
    const store = new DataStore();
    store.register({ id: 'products', rows: [{ id: 1, title: 'Red Shoe', desc: 'Nice' }] });
    const owner: RenderedItem & never = {
      id: 'w', el: wrapper, dataSource: { id: 'products', mode: 'single', params: { slug: '@route.slug' } },
      children: [{ id: 'h', el: wrapper.children[0], binding: { content: '{{title}}' } }, { id: 'p', el: wrapper.children[1], binding: { content: '{{desc}}' } }],
    } as never;
    const rs = new RecordScope({ store, getContext: () => ({ route: { slug: 'red' } }) as never, owner, el: wrapper });
    await rs.refresh();
    expect(wrapper.querySelector('h1')!.textContent).toBe('Red Shoe');
    expect(wrapper.querySelector('p')!.textContent).toBe('Nice');
    expect(wrapper.getAttribute('data-pb-state')).toBe('ready');
    expect(findScope(wrapper.querySelector('p'))!.row).toMatchObject({ id: 1 });
    rs.destroy();
    expect(findScope(wrapper.querySelector('p'))).toBeUndefined();
  });
});
