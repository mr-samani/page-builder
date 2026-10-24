import { describe, expect, it } from 'vitest';
import { compileTemplate, escapeHtml, hasTemplate, readRef, renderTemplate, toText } from './template';
import { createScope } from './scope';
import { SafeString } from './format';

const row = { title: 'Red <b>Shoe</b>', price: 1234.5, tags: ['a', 'b'], stock: 0, img: 'a b.png', n: null, nested: { deep: 'D' }, date: '2026-03-04T10:00:00Z' };
const scope = createScope({ route: { slug: 'red shoes' }, query: { page: '2', tag: ['x', 'y'] }, page: { site: { title: 'My shop' } }, global: { cur: 'USD' }, locale: 'en-US' }, row, undefined, 2, 5);

describe('compileTemplate', () => {
  it('static text has no tokens and returns itself', () => {
    const t = compileTemplate('Hello world');
    expect(t.isStatic).toBe(true);
    expect(t.render(scope)).toBe('Hello world');
    expect(compileTemplate('')).toBe(compileTemplate(''));
  });

  it('substitutes row fields, nested paths and scope roots', () => {
    expect(renderTemplate('{{title}}|{{row.nested.deep}}|{{route.slug}}|{{query.page}}|{{page.site.title}}|{{global.cur}}', scope)).toBe(
      'Red <b>Shoe</b>|D|red shoes|2|My shop|USD',
    );
  });

  it('exposes loop variables', () => {
    expect(renderTemplate('{{$index}}/{{$number}}/{{$count}}/{{$first}}/{{$last}}/{{$odd}}/{{$even}}', scope)).toBe('2/3/5/false/false/false/true');
  });

  it('missing values render empty (never "undefined")', () => {
    expect(renderTemplate('[{{nope}}][{{n}}][{{nested.nope.deeper}}]', scope)).toBe('[][][]');
  });

  it('?? provides a fallback for null / undefined / empty only', () => {
    expect(renderTemplate("{{nope ?? 'N/A'}}", scope)).toBe('N/A');
    expect(renderTemplate("{{n ?? 'N/A'}}", scope)).toBe('N/A');
    expect(renderTemplate("{{stock ?? 'N/A'}}", scope)).toBe('0'); // 0 is a real value
    expect(renderTemplate('{{nope ?? 7}}', scope)).toBe('7');
    expect(renderTemplate("{{nope ?? 'a|b'}}", scope)).toBe('a|b'); // separator inside quotes
  });

  it('escapes by mode', () => {
    expect(renderTemplate('<h1>{{title}}</h1>', scope, 'html')).toBe('<h1>Red &lt;b&gt;Shoe&lt;/b&gt;</h1>'); // literal markup untouched, value escaped
    expect(renderTemplate('{{title}}', scope, 'text')).toBe('Red <b>Shoe</b>');
    expect(renderTemplate('/p/{{route.slug}}?i={{img}}', scope, 'url')).toBe('/p/red%20shoes?i=a%20b.png');
  });

  it('the raw pipe opts out of escaping', () => {
    expect(renderTemplate('{{title | raw}}', scope, 'html')).toBe('Red <b>Shoe</b>');
    expect(renderTemplate('{{route.slug | raw}}', scope, 'url')).toBe('red shoes');
  });

  it('keeps malformed tokens as literal text and never throws', () => {
    expect(renderTemplate('a {{ }} b {{ 1bad path }} c {{unclosed', scope)).toBe('a {{ }} b {{ 1bad path }} c {{unclosed');
    expect(renderTemplate('{{title | }}', scope)).toBe('{{title | }}');
  });

  it('tolerates braces inside quoted fallbacks', () => {
    expect(renderTemplate("{{nope ?? '}}'}}", scope)).toBe('}}');
  });

  it('applies pipes left to right', () => {
    expect(renderTemplate('{{title | stripTags | upper}}', scope)).toBe('RED SHOE');
    expect(renderTemplate("{{price | number:2 | default:'-'}}", scope)).toBe('1,234.50');
    expect(renderTemplate("{{nope | default:'x'}}", scope)).toBe('x');
  });

  it('unknown pipes leave the value unchanged', () => {
    expect(renderTemplate('{{stock | doesNotExist}}', scope)).toBe('0');
  });

  it('reports the fields it needs (for server-side projection)', () => {
    const t = compileTemplate('{{title}} - {{row.price | currency:"USD"}} {{route.slug}} {{parent.id}} {{nested.deep}}');
    expect([...t.fields].sort()).toEqual(['nested', 'price', 'title']);
    expect(t.usesWholeRow).toBe(false);
    expect(t.usesParent).toBe(true);
    expect(t.parentFields).toEqual(['id']);
    expect([...t.roots].sort()).toEqual(['parent', 'route', 'row']);
    expect(compileTemplate('{{row | json}}').usesWholeRow).toBe(true);
    expect(compileTemplate('{{$index}} {{route.x}}').usesRow).toBe(false);
  });

  it('evaluate() keeps the type of a single token', () => {
    expect(compileTemplate('{{price}}').evaluate(scope)).toBe(1234.5);
    expect(compileTemplate('{{tags}}').evaluate(scope)).toEqual(['a', 'b']);
    expect(compileTemplate('x{{price}}').evaluate(scope)).toBe('x1234.5');
  });

  it('is cached: the same source compiles once', () => {
    expect(compileTemplate('{{a}}-{{b}}')).toBe(compileTemplate('{{a}}-{{b}}'));
  });
});

describe('renderOrEmpty', () => {
  it('returns empty when every token is empty, keeps literal text otherwise', () => {
    const t = compileTemplate('url("{{img}}")');
    expect(t.renderOrEmpty(scope)).toBe('url("a b.png")');
    expect(t.renderOrEmpty(createScope({}, { img: '' }))).toBe('');
    expect(t.renderOrEmpty(createScope({}, {}))).toBe('');
    expect(compileTemplate('/p/{{a}}/{{b}}').renderOrEmpty(createScope({}, { a: 'x' }))).toBe('/p/x/');
    expect(compileTemplate('static').renderOrEmpty(scope)).toBe('static');
  });
});

describe('helpers', () => {
  it('hasTemplate', () => {
    expect(hasTemplate('a {{b}}')).toBe(true);
    expect(hasTemplate('a')).toBe(false);
    expect(hasTemplate(5)).toBe(false);
  });
  it('escapeHtml', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    expect(escapeHtml('plain')).toBe('plain');
  });
  it('toText never prints [object Object]', () => {
    expect(toText({ a: 1 })).toBe('');
    expect(toText([1, 'b', null])).toBe('1, b, ');
    expect(toText(new SafeString('<i>'))).toBe('<i>');
    expect(toText(NaN)).toBe('');
    expect(toText(true)).toBe('true');
  });
  it('readRef resolves a reference path', () => {
    expect(readRef(scope, 'route.slug')).toBe('red shoes');
    expect(readRef(scope, '$index')).toBe(2);
    expect(readRef(scope, 'bad..path')).toBeUndefined();
  });
});
