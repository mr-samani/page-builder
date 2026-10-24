import { describe, expect, it } from 'vitest';
import { stableStringify } from './stable-json';

describe('stableStringify', () => {
  it('sorts keys at every depth, so key order never changes the result', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: [{ y: 1, x: 2 }] } })).toBe('{"a":{"c":[{"x":2,"y":1}],"d":2},"b":1}');
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
  });

  it('behaves like JSON.stringify for dropped / converted values', () => {
    expect(stableStringify({ a: undefined, b: () => 1, c: Symbol('x'), d: null })).toBe('{"d":null}');
    expect(stableStringify([undefined, () => 1])).toBe('[null,null]');
    expect(stableStringify(NaN)).toBe('null');
    expect(stableStringify(Infinity)).toBe('null');
    expect(stableStringify(new Date('2026-01-02T03:04:05.000Z'))).toBe('"2026-01-02T03:04:05.000Z"');
    expect(stableStringify(new Date('nope'))).toBe('null');
    expect(stableStringify(10n)).toBe('"10"');
    expect(stableStringify(undefined)).toBe('null');
  });

  it('keeps unicode readable and escapes quotes', () => {
    expect(stableStringify({ q: 'سلام "دنیا"' })).toBe('{"q":"سلام \\"دنیا\\""}');
  });

  it('throws on circular structures instead of overflowing the stack', () => {
    const a: Record<string, unknown> = {};
    a['self'] = a;
    expect(() => stableStringify(a)).toThrow(RangeError);
  });
});
