import { describe, expect, it } from 'vitest';
import { applyFormatter, registerFormatter, SafeString } from './format';

const f = (name: string, v: unknown, args: unknown[] = [], locale = 'en-US') => applyFormatter(name, v, args, locale);

describe('formatters', () => {
  it('number / currency / percent / compact', () => {
    expect(f('number', 1234.5)).toBe('1,234.5');
    expect(f('number', 1234.5, [2])).toBe('1,234.50');
    expect(f('number', '1234')).toBe('1,234');
    expect(f('number', 'abc')).toBe('abc'); // bad input is returned unchanged
    expect(f('currency', 9.5, ['usd'])).toBe('$9.50');
    expect(f('currency', 9.5, ['EUR', 'code'])).toMatch(/EUR/);
    expect(f('currency', 9.5, [])).toBe('9.5'); // no code → plain number
    expect(f('percent', 0.256, [1])).toBe('25.6%');
    expect(f('compact', 1500)).toBe('1.5K');
  });

  it('locale aware (Persian digits)', () => {
    expect(f('number', 1234, [], 'fa-IR')).toBe('۱٬۲۳۴');
  });

  it('date / time / datetime', () => {
    const iso = '2026-03-04T10:30:00Z';
    expect(f('date', iso, ['iso'])).toBe('2026-03-04T10:30:00.000Z');
    expect(String(f('date', iso, ['long']))).toMatch(/March 4, 2026|4 March 2026/);
    expect(String(f('time', iso, ['short']))).toMatch(/\d{1,2}:\d{2}/);
    expect(String(f('datetime', iso))).toMatch(/2026/);
    expect(f('date', '')).toBe('');
    expect(f('date', 'not a date')).toBe('not a date');
  });

  it('text helpers', () => {
    expect(f('upper', 'abc')).toBe('ABC');
    expect(f('lower', 'ABC')).toBe('abc');
    expect(f('capitalize', 'hello')).toBe('Hello');
    expect(f('trim', '  x ')).toBe('x');
    expect(f('truncate', 'hello world', [5])).toBe('hello…');
    expect(f('truncate', 'hello', [5])).toBe('hello');
    expect(f('truncate', 'hello world', [5, '...'])).toBe('hello...');
    expect(f('truncate', '😀😀😀😀', [2])).toBe('😀😀…'); // never splits a surrogate pair
    expect(f('stripTags', '<p>Hello&nbsp;<b>world</b></p>')).toBe('Hello world');
    expect(f('slug', 'Red Shoes & More!')).toBe('red-shoes-more');
    expect(f('slug', 'کفش ورزشی مردانه')).toBe('کفش-ورزشی-مردانه');
  });

  it('collections', () => {
    expect(f('join', ['a', 'b'])).toBe('a, b');
    expect(f('join', ['a', 'b'], [' / '])).toBe('a / b');
    expect(f('join', 'x')).toBe('x');
    expect(f('length', [1, 2, 3])).toBe(3);
    expect(f('length', 'abcd')).toBe(4);
    expect(f('length', 5)).toBe(0);
    expect(f('json', { a: 1 })).toBe('{"a":1}');
  });

  it('default / url / raw / plural', () => {
    expect(f('default', '', ['x'])).toBe('x');
    expect(f('default', 0, ['x'])).toBe(0);
    expect(f('url', 'a b&c')).toBe('a%20b%26c');
    expect(f('raw', '<b>')).toBeInstanceOf(SafeString);
    expect(f('plural', 1, ['item', 'items'])).toBe('item');
    expect(f('plural', 3, ['item', 'items'])).toBe('items');
    expect(f('plural', 0, ['item', 'items', 'none'])).toBe('none');
  });

  it('custom formatters can be registered; a throwing formatter returns the input', () => {
    registerFormatter('double', (v) => Number(v) * 2);
    expect(f('double', 4)).toBe(8);
    registerFormatter('boom', () => {
      throw new Error('x');
    });
    expect(f('boom', 'safe')).toBe('safe');
  });
});
