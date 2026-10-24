import { describe, expect, it } from 'vitest';
import { applyBinding, buildStaticHref, compileBinding, isTruthy, legacyBinding, legacyHrefTemplate, resolveBinding, type BoundValues } from './item-binding';
import { createScope } from './scope';
import { isUnsafeUrl } from './url-safety';

const scope = (row: Record<string, unknown>, ctx = {}) => createScope({ locale: 'en-US', ...ctx }, row);
const el = (html = '<div></div>') => {
  const t = document.createElement('template');
  t.innerHTML = html;
  return t.content.firstElementChild as HTMLElement;
};

describe('legacy bindings', () => {
  it('maps dataSource.binding by tag: text, src, value', () => {
    expect(legacyBinding({ tag: 'h3', dataSource: { binding: 'title' } })).toEqual({ content: '{{title}}' });
    expect(legacyBinding({ tag: 'img', dataSource: { binding: 'image' } })).toEqual({ attrs: { src: '{{image}}' } });
    expect(legacyBinding({ tag: 'input', dataSource: { binding: 'name' } })).toEqual({ attrs: { value: '{{name}}' } });
    expect(legacyBinding({ tag: 'div', dataSource: {} })).toBeUndefined(); // an empty dataSource object (the old UI added one to every block)
  });

  it('builds dynamic hrefs from the link editor with encoding and the hash kept last', () => {
    const item = { tag: 'a', options: { attributes: { href: '/product#reviews' }, customData: { queryString: [{ key: 'id', value: 'id', isDynamic: true }, { key: 'tab', value: 'a b' }] } } };
    expect(legacyHrefTemplate(item)).toBe('/product?id={{id | url}}&tab=a%20b#reviews');
  });

  it('appends to an existing query with & and skips empty entries', () => {
    const item = { tag: 'a', options: { attributes: { href: '/p?x=1' }, customData: { queryString: [{ key: 'id', value: 'pid', isDynamic: true }, { key: '', value: 'x' }, { key: 'e', value: '' }] } } };
    expect(legacyHrefTemplate(item)).toBe('/p?x=1&id={{pid | url}}');
  });

  it('static links: no dangling "?" for an empty list (the old code produced "/page?") and values are encoded', () => {
    expect(buildStaticHref({ tag: 'a', options: { attributes: { href: '/page' }, customData: { queryString: [] } } })).toBeUndefined();
    expect(buildStaticHref({ tag: 'a', options: { attributes: { href: '/page' }, customData: { queryString: [{ key: 'q', value: 'a&b=c' }] } } })).toBe('/page?q=a%26b%3Dc');
    expect(buildStaticHref({ tag: 'a', options: { attributes: { href: '/p' }, customData: { queryString: [{ key: 'id', value: 'id', isDynamic: true }] } } })).toBeUndefined();
  });

  it('explicit item.binding wins over legacy, attrs are merged', () => {
    const r = resolveBinding({ tag: 'img', binding: { attrs: { src: '{{thumb}}', alt: '{{title}}' } }, dataSource: { binding: 'image' } });
    expect(r?.attrs).toEqual({ src: '{{thumb}}', alt: '{{title}}' });
    expect(resolveBinding({ tag: 'p' })).toBeUndefined();
  });
});

describe('compileBinding', () => {
  it('reports fields, whole-row use and parent fields', () => {
    const c = compileBinding({ content: '{{title}} {{parent.name}}', attrs: { href: '/p/{{slug}}' }, showIf: '{{stock}}' });
    expect([...c.fields].sort()).toEqual(['slug', 'stock', 'title']);
    expect(c.parentFields).toEqual(['name']);
    expect(c.usesParent).toBe(true);
    expect(compileBinding({ content: '{{row | json}}' }).usesWholeRow).toBe(true);
  });
  it('an empty / undefined binding compiles to a shared empty object', () => {
    expect(compileBinding(undefined)).toBe(compileBinding({}));
  });
});

describe('applyBinding', () => {
  it('writes text with textContent — data can never inject markup', () => {
    const e = el('<h3></h3>');
    applyBinding(e, compileBinding({ content: '{{title}}' }), scope({ title: '<img src=x onerror=alert(1)>' }));
    expect(e.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(e.children.length).toBe(0);
  });

  it("html mode escapes substituted values but keeps the author's markup", () => {
    const e = el('<div></div>');
    applyBinding(e, compileBinding({ content: '<b>{{title}}</b>', html: true }), scope({ title: '<script>x</script>' }));
    expect(e.innerHTML).toBe('<b>&lt;script&gt;x&lt;/script&gt;</b>');
  });

  it('html mode runs the host sanitizer hook', () => {
    const e = el('<div></div>');
    applyBinding(e, compileBinding({ content: '<i>{{t}}</i>', html: true }), scope({ t: 'x' }), {}, { sanitizeHtml: (h) => h.replace(/<i>|<\/i>/g, '') });
    expect(e.innerHTML).toBe('x');
  });

  it('sets attributes, removes empty src/href (an empty src would request the page itself)', () => {
    const e = el('<img src="old.png">');
    const b = compileBinding({ attrs: { src: '{{image}}', alt: '{{title}}', 'data-id': '{{id}}' } });
    let last = applyBinding(e, b, scope({ image: '/a.png', title: 'A', id: 5 }));
    expect([e.getAttribute('src'), e.getAttribute('alt'), e.getAttribute('data-id')]).toEqual(['/a.png', 'A', '5']);
    last = applyBinding(e, b, scope({ image: '', title: 'A', id: 5 }), last);
    expect(e.hasAttribute('src')).toBe(false);
    expect(e.getAttribute('alt')).toBe('A');
  });

  it('blocks javascript: and data:text/html URLs in link/src attributes', () => {
    const e = el('<a href="/ok">x</a>');
    const b = compileBinding({ attrs: { href: '{{url}}' } });
    applyBinding(e, b, scope({ url: 'javascript:alert(1)' }));
    expect(e.hasAttribute('href')).toBe(false);
    applyBinding(e, b, scope({ url: ' Java\tScript:alert(1)' }));
    expect(e.hasAttribute('href')).toBe(false);
    applyBinding(e, b, scope({ url: 'https://ok.com/x' }));
    expect(e.getAttribute('href')).toBe('https://ok.com/x');
  });

  it('encodes substituted values inside a URL path template but keeps a whole-URL token intact', () => {
    const e = el('<a></a>');
    applyBinding(e, compileBinding({ attrs: { href: '/product/{{slug}}?ref={{ref}}' } }), scope({ slug: 'red shoes/2', ref: 'a&b' }));
    expect(e.getAttribute('href')).toBe('/product/red%20shoes%2F2?ref=a%26b');
    applyBinding(e, compileBinding({ attrs: { href: '{{url}}' } }), scope({ url: 'https://x.com/a b?c=d' }));
    expect(e.getAttribute('href')).toBe('https://x.com/a b?c=d');
  });

  it('toggles classes and inline styles', () => {
    const e = el('<div class="card"></div>');
    const b = compileBinding({ classes: { 'is-sale': '{{onSale}}', 'is-new': '{{isNew}}' }, styles: { 'background-image': 'url("{{image}}")' } });
    let last = applyBinding(e, b, scope({ onSale: true, isNew: 0, image: '/a.png' }));
    expect(e.classList.contains('is-sale')).toBe(true);
    expect(e.classList.contains('is-new')).toBe(false);
    expect(e.style.backgroundImage).toContain('/a.png');
    last = applyBinding(e, b, scope({ onSale: false, isNew: 'true', image: '' }), last);
    expect(e.className).toBe('card is-new');
    expect(e.style.backgroundImage).toBe('');
  });

  it('showIf / hideIf hide with display:none and restore the original display', () => {
    const e = el('<div style="display:flex"></div>');
    const b = compileBinding({ showIf: '{{stock}}', hideIf: '{{archived}}' });
    let last = applyBinding(e, b, scope({ stock: 0, archived: false }));
    expect(e.style.display).toBe('none');
    expect(e.getAttribute('aria-hidden')).toBe('true');
    last = applyBinding(e, b, scope({ stock: 3, archived: false }), last);
    expect(e.style.display).toBe('flex');
    expect(e.hasAttribute('aria-hidden')).toBe(false);
    last = applyBinding(e, b, scope({ stock: 3, archived: true }), last);
    expect(e.style.display).toBe('none');
  });

  it('only touches the DOM for values that changed (dirty checking)', () => {
    const e = el('<div></div>');
    const b = compileBinding({ content: '{{t}}', attrs: { title: '{{t}}' } });
    const mo = new MutationObserver(() => undefined);
    mo.observe(e, { childList: true, attributes: true, characterData: true, subtree: true });
    let last: BoundValues = applyBinding(e, b, scope({ t: 'A' }));
    mo.takeRecords(); // the first write is expected
    last = applyBinding(e, b, scope({ t: 'A' }), last);
    last = applyBinding(e, b, scope({ t: 'A' }), last);
    expect(mo.takeRecords()).toHaveLength(0); // repeats wrote nothing
    expect(last.content).toBe('A');
  });
});

describe('helpers', () => {
  it('isTruthy follows UI expectations, not JS ("0" and "false" strings are false)', () => {
    for (const f of [null, undefined, false, 0, '', ' ', 'false', '0', 'null', [], Number.NaN]) expect(isTruthy(f)).toBe(false);
    for (const t of [true, 1, 'yes', 'abc', [0], {}, -1]) expect(isTruthy(t)).toBe(true);
  });
  it('isUnsafeUrl', () => {
    expect(isUnsafeUrl('javascript:alert(1)')).toBe(true);
    expect(isUnsafeUrl('  VBScript:x')).toBe(true);
    expect(isUnsafeUrl('data:text/html;base64,AAA')).toBe(true);
    expect(isUnsafeUrl('data:image/png;base64,AAA')).toBe(false);
    expect(isUnsafeUrl('data:image/svg+xml;base64,AAA', 'img', 'src')).toBe(false);
    expect(isUnsafeUrl('data:image/svg+xml;base64,AAA', 'a', 'href')).toBe(true);
    expect(isUnsafeUrl('/relative/path')).toBe(false);
    expect(isUnsafeUrl('https://example.com')).toBe(false);
    expect(isUnsafeUrl('mailto:a@b.c')).toBe(false);
  });
});
