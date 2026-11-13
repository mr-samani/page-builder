import 'reflect-metadata';
import '@angular/compiler';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body></body></html>');
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
  Element: dom.window.Element, Node: dom.window.Node, MutationObserver: dom.window.MutationObserver,
});
import { Injector, runInInjectionContext, DOCUMENT } from '@angular/core';
import { DynamicElementService } from '../../src/core/services/dynamic-element.service';
import { PageItem, DataSourceSetting } from 'ngx-page-builder/core';
import { applyTemplateChange, syncRows, ReconcileEnv, CollectionSyncContext } from '../../src/designer/sources/collection-item/collection-reconciler';

const doc = dom.window.document;
let ops = 0; // DOM operations done by the service (to compare cost)
const renderer: any = {
  createElement: (t: string) => doc.createElement(t),
  setAttribute: (e: Element, n: string, v: string) => { ops++; e.setAttribute(n, v); },
  removeAttribute: (e: Element, n: string) => { ops++; e.removeAttribute(n); },
  setProperty: (e: any, n: string, v: any) => { ops++; e[n] = v; },
  insertBefore: (p: Node, c: Node, r: Node | null) => { ops++; p.insertBefore(c, r); },
  appendChild: (p: Node, c: Node) => { ops++; p.appendChild(c); },
  removeChild: (p: Node, c: Node) => { ops++; p.removeChild(c); },
  listen: () => () => {},
};
const svc = runInInjectionContext(Injector.create({ providers: [{ provide: DOCUMENT, useValue: doc }] }), () =>
  new DynamicElementService({ createRenderer: () => renderer } as any, {} as any, {} as any));

// same recursion as PageBuilderService.createBlockElement (without designer-only directives)
async function render(item: PageItem, container: HTMLElement, index: number): Promise<HTMLElement> {
  const el = await svc.createBlock([], false, container, index, item);
  for (const child of item.children) await render(child, el, -1);
  return el;
}
const env: ReconcileEnv = {
  createBlock: (i, c, idx) => render(i, c, idx),
  destroyBlock: (i) => svc.destroy(i),
  patchBlock: (i, n) => svc.patchBlock(i, n),
  isCancelled: () => false,
};

const ds = (o: any) => Object.assign(new DataSourceSetting(), o);
const mk = (id: string, tag: string, extra: any = {}) => ({
  id, tag, classList: ['block-item', 'blk-' + id], css: { base: 'color:black' }, canHaveChild: false, ...extra,
});
function templateSpec() {
  return {
    ...mk('root', 'article', { canHaveChild: true, isTemplateContainer: true, css: { base: 'padding:10px' } }),
    children: [
      mk('name', 'h3', { dataSource: ds({ binding: 'name' }) }),
      mk('desc', 'p', { content: '{{title}} - {{price}}' }),
      mk('pic', 'img', { dataSource: ds({ binding: 'image' }), options: { attributes: { alt: 'x' } } }),
      mk('lnk', 'a', { content: 'open', options: { attributes: { href: '/p' }, customData: { queryString: [{ key: 'id', value: 'id', isDynamic: true }] } } }),
      { ...mk('box', 'div', { canHaveChild: true }), children: [mk('s1', 'span', { content: 'one' }), mk('s2', 'span', { content: 'two', css: undefined, classList: ['block-item'] })] },
    ],
  };
}
const records = (n: number, rev = false) => {
  const r = Array.from({ length: n }, (_, i) => ({ name: 'N' + i, title: 'T' + i, price: String(i * 10), image: 'img' + i + '.png', id: i }));
  return rev ? r.reverse() : r;
};

// ------------------------------------------------------------------ helpers
function ser(el: Element): any {
  const attrs: Record<string, string> = {};
  for (const a of Array.from(el.attributes).sort((x, y) => x.name.localeCompare(y.name))) if (a.name !== 'class') attrs[a.name] = a.value;
  return { t: el.tagName, c: [...el.classList].sort().join(' '), a: attrs,
    x: el.children.length ? undefined : el.innerHTML, k: Array.from(el.children).map(ser) };
}
function checkModel(item: PageItem, parentEl?: Element, path = ''): string[] {
  const err: string[] = [];
  if (!item.el) return [`${path}/${item.id}: no el`];
  if (parentEl && item.el.parentElement !== parentEl) err.push(`${path}/${item.id}: el not in parent el`);
  if (item.children.length !== item.el.children.length && !item.customComponent) err.push(`${path}/${item.id}: children count ${item.children.length} vs dom ${item.el.children.length}`);
  item.children.forEach((c, i) => {
    if (c.parent !== item) err.push(`${path}/${c.id}: wrong parent`);
    if (item.el!.children[i] !== c.el) err.push(`${path}/${c.id}: dom order differs at ${i}`);
    err.push(...checkModel(c, item.el!, path + '/' + item.id));
  });
  return err;
}
async function oracle(owner: PageItem, recs: any[]): Promise<any[]> {
  const { cloneTemplate } = await import('ngx-page-builder/core');
  const box = doc.createElement('div');
  const out: any[] = [];
  for (let i = 0; i < recs.length; i++) {
    const row = cloneTemplate(recs, owner.template!, i);
    await render(row, box, -1);
  }
  return Array.from(box.children).map(ser);
}
async function verify(name: string, owner: PageItem, host: HTMLElement, recs: any[]) {
  const want = JSON.stringify(await oracle(owner, recs));
  const got = JSON.stringify(Array.from(host.children).map(ser));
  const errs = owner.children.flatMap((r) => checkModel(r, host));
  if (want !== got || errs.length || owner.children.length !== recs.length) {
    console.log('FAIL', name);
    if (want !== got) {
      const w = JSON.parse(want), g = JSON.parse(got);
      for (let i = 0; i < Math.max(w.length, g.length); i++) if (JSON.stringify(w[i]) !== JSON.stringify(g[i])) { console.log(' row', i, '\n  want', JSON.stringify(w[i]).slice(0, 900), '\n  got ', JSON.stringify(g[i]).slice(0, 900)); break; }
    }
    errs.slice(0, 5).forEach((e) => console.log(' model:', e));
    process.exitCode = 1;
  } else console.log('ok  ', name);
}
const idsOf = (root: PageItem, m = new Map<string, HTMLElement>()) => { m.set(root.id, root.el!); root.children.forEach((c) => idsOf(c, m)); return m; };
function find(root: PageItem, id: string): PageItem { if (root.id === id) return root; for (const c of root.children) { const f = c.id === id ? c : (() => { try { return find(c, id); } catch { return undefined; } })(); if (f) return f; } throw new Error('nf ' + id); }

async function main() {
  const host = doc.createElement('div'); doc.body.appendChild(host);
  const owner = new PageItem({ id: 'coll', tag: 'collection', canHaveChild: false } as any);
  owner.template = new PageItem(templateSpec() as any, owner);
  let recs = records(5);
  const ctx = (): CollectionSyncContext => ({ owner, host, records: recs, env });

  await syncRows(ctx());
  await verify('initial render (5 rows)', owner, host, recs);

  // ---- S1 add block in row 2, position 1
  {
    const before = idsOf(owner.children[0]);
    const o = owner.children[2];
    const item = new PageItem(mk('new1', 'p', { content: 'hello', css: { base: 'color:red' } }) as any, o);
    await render(item, o.el!, 1); o.children.splice(1, 0, item);
    await applyTemplateChange(ctx(), o);
    await verify('AddBlock in row 2 -> all rows', owner, host, recs);
    const after = idsOf(owner.children[0]);
    const same = ['name', 'desc', 'pic', 'lnk', 'box', 's1', 's2'].every((k) => before.get(k) === after.get(k));
    console.log(same ? 'ok   existing elements were NOT re-created' : 'FAIL existing elements re-created'); if (!same) process.exitCode = 1;
    console.log(owner.children.every((r) => r === o || find(r, 'new1').css === owner.template!.children[1].css) ? 'ok   css object shared' : 'FAIL css not shared');
  }
  // ---- S2 add into nested container of row 4
  {
    const o = owner.children[4]; const box = find(o, 'box');
    const item = new PageItem(mk('new2', 'span', { content: 'deep' }) as any, box);
    await render(item, box.el!, -1); box.children.push(item);
    await applyTemplateChange(ctx(), o);
    await verify('AddBlock nested (row 4, box)', owner, host, recs);
  }
  // ---- S3 remove
  {
    const o = owner.children[0]; const d = find(o, 'desc');
    o.children.splice(o.children.indexOf(d), 1); await svc.destroy(d);
    await applyTemplateChange(ctx(), o);
    await verify('RemoveBlock desc (row 0)', owner, host, recs);
  }
  // ---- S4 move pic before name
  {
    const o = owner.children[3]; const pic = find(o, 'pic');
    o.children.splice(o.children.indexOf(pic), 1); await svc.destroy(pic);
    pic.parent = o; await render(pic, o.el!, 0); o.children.splice(0, 0, pic);
    await applyTemplateChange(ctx(), o);
    await verify('MoveBlock pic to top (row 3)', owner, host, recs);
  }
  // ---- S5 content
  {
    const o = owner.children[1]; const s1 = find(o, 's1');
    s1.content = 'ONE!'; s1.el!.innerHTML = 'ONE!';
    await applyTemplateChange(ctx(), o);
    await verify('ChangeBlockContent s1 (row 1)', owner, host, recs);
  }
  // ---- S6 attributes
  {
    const o = owner.children[2]; const a = find(o, 'lnk');
    a.options!.attributes!['href'] = '/other'; a.el!.setAttribute('href', '/other?id=2'); a.options!.attributes!['target'] = '_blank'; a.el!.setAttribute('target', '_blank');
    find(o, 'box').options = { attributes: { 'data-x': '1' } }; find(o, 'box').el!.setAttribute('data-x', '1');
    await applyTemplateChange(ctx(), o);
    await verify('attributes: href/target/data-x (row 2)', owner, host, recs);
  }
  // ---- S7 style only (css object mutated in place, nothing else)
  {
    const o = owner.children[1];
    const mo = new dom.window.MutationObserver(() => {}); mo.observe(host, { subtree: true, childList: true, attributes: true, characterData: true });
    find(o, 'name').css!.base = 'color:blue;font-size:20px';
    const t0 = ops; await applyTemplateChange(ctx(), o);
    const mutations = mo.takeRecords().length; mo.disconnect();
    console.log(mutations === 0 && ops === t0 ? 'ok   style-only change: 0 DOM operations' : `FAIL style-only change did DOM work (${mutations} mutations, ${ops - t0} ops)`);
    if (mutations || ops !== t0) process.exitCode = 1;
    await verify('style-only result', owner, host, recs);
    console.log(owner.children.every((r) => find(r, 'name').css === find(owner.children[1], 'name').css) ? 'ok   all copies share the style object' : 'FAIL style object not shared');
  }
  // ---- S8 first style on a block that had none (class blk-s2 appears)
  {
    const o = owner.children[0]; const s2 = find(o, 's2');
    s2.css = { base: 'color:green' }; s2.classList.push('blk-s2'); s2.el!.classList.add('blk-s2');
    await applyTemplateChange(ctx(), o);
    await verify('first style on s2: class added in all rows', owner, host, recs);
    console.log(owner.children.every((r) => find(r, 's2').el!.classList.contains('blk-s2') && find(r, 's2').css === s2.css) ? 'ok   class + css reference in all rows' : 'FAIL class/css'); 
  }
  // ---- S9 tag change of box (div -> section)
  {
    const o = owner.children[3]; const box = find(o, 'box'); const idx = o.children.indexOf(box);
    o.children.splice(idx, 1); await svc.destroy(box);
    const nb = new PageItem({ ...mk('box', 'section', { canHaveChild: true }), children: box.children.map((c) => ({ ...c, children: [], parent: undefined, el: undefined })) } as any, o);
    await render(nb, o.el!, idx); o.children.splice(idx, 0, nb);
    await applyTemplateChange(ctx(), o);
    await verify('ChangeTagName box -> section (row 3)', owner, host, recs);
  }
  // ---- S10 bind desc to a field (inline-edit directive differs => replace)
  {
    const o = owner.children[4]; const d = o.children.find((c) => c.id === 'name')!;
    d.dataSource = ds({ binding: 'title' }); d.content = 'T4'; d.el!.innerHTML = 'T4'; // the designer re-renders the edited block itself
    await applyTemplateChange(ctx(), o);
    await verify('binding of name changed (row 4)', owner, host, recs);
  }
  // ---- S11 records: grow, reorder, shrink
  recs = records(8); await syncRows(ctx()); await verify('records 5 -> 8', owner, host, recs);
  recs = records(8, true); await syncRows(ctx()); await verify('records reversed (bound values patched in place)', owner, host, recs);
  recs = records(3); await syncRows(ctx()); await verify('records 8 -> 3', owner, host, recs);
  recs = []; await syncRows(ctx()); await verify('records -> empty', owner, host, recs);

  // ------------------------------------------------------------------ performance (jsdom, relative numbers)
  console.log('\n--- performance: 100 rows x ~32 blocks (jsdom, no Angular directives => real browser is slower for both)');
  const big = () => { const spec: any = templateSpec(); spec.children.push(...Array.from({ length: 25 }, (_, i) => mk('x' + i, 'span', { content: 'c' + i }))); return spec; };
  const host2 = doc.createElement('div'); doc.body.appendChild(host2);
  const owner2 = new PageItem({ id: 'coll2', tag: 'collection' } as any); owner2.template = new PageItem(big(), owner2);
  const recs2 = records(100);
  const ctx2 = (): CollectionSyncContext => ({ owner: owner2, host: host2, records: recs2, env });
  let t = performance.now(); await syncRows(ctx2()); const tInit = performance.now() - t;

  // OLD behaviour: template = copy of the changed row, destroy all rows, create all rows
  const { cloneTemplate } = await import('ngx-page-builder/core');
  async function oldRebuild() { await svc.destroyBatch(owner2.children); owner2.children = []; for (let i = 0; i < recs2.length; i++) { const c = cloneTemplate(recs2, owner2.template!, i); c.parent = owner2; await render(c, host2, -1); owner2.children.push(c); } }
  t = performance.now(); await oldRebuild(); const tOld = performance.now() - t;

  const o = owner2.children[10]; const it = new PageItem(mk('nb', 'p', { content: 'hello' }) as any, o); await render(it, o.el!, 1); o.children.splice(1, 0, it);
  const opsBefore = ops; t = performance.now(); await applyTemplateChange(ctx2(), o); const tAdd = performance.now() - t; const opsAdd = ops - opsBefore;
  await verify('perf scenario result (AddBlock, 100 rows)', owner2, host2, recs2);
  find(o, 'name').css!.base = 'color:pink';
  t = performance.now(); await applyTemplateChange(ctx2(), o); const tStyle = performance.now() - t;
  console.log(`initial render      : ${tInit.toFixed(1)} ms`);
  console.log(`old: rebuild all    : ${tOld.toFixed(1)} ms  (every change)`);
  console.log(`new: add one block  : ${tAdd.toFixed(1)} ms  (${opsAdd} DOM ops, 99 blocks created)`);
  console.log(`new: style change   : ${tStyle.toFixed(2)} ms`);
}
main().catch((e) => { console.error(e); process.exit(2); });
