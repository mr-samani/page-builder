/**
 * Formatters for `{{ price | currency:'USD' }}`.
 * A formatter never throws: on bad input it returns the value unchanged (a page must not break because of one cell).
 */

/** Output that must NOT be escaped (the author vouches for it). */
export class SafeString {
  constructor(public readonly value: string) {}
  toString(): string {
    return this.value;
  }
}

export type Formatter = (value: unknown, args: readonly unknown[], locale: string | undefined) => unknown;

const formatters = new Map<string, Formatter>();

export function registerFormatter(name: string, fn: Formatter): void {
  formatters.set(name, fn);
}
export function hasFormatter(name: string): boolean {
  return formatters.has(name);
}

export function applyFormatter(name: string, value: unknown, args: readonly unknown[], locale?: string): unknown {
  const fn = formatters.get(name);
  if (!fn) return value;
  try {
    return fn(value, args, locale);
  } catch {
    return value;
  }
}

//---------------------------------------------------------------- Intl caches (constructing them is slow)

const nf = new Map<string, Intl.NumberFormat>();
const df = new Map<string, Intl.DateTimeFormat>();
const pr = new Map<string, Intl.PluralRules>();

function numberFormat(locale: string | undefined, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const k = `${locale ?? ''}|${JSON.stringify(opts)}`;
  let f = nf.get(k);
  if (!f) nf.set(k, (f = new Intl.NumberFormat(locale, opts)));
  return f;
}
function dateFormat(locale: string | undefined, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const k = `${locale ?? ''}|${JSON.stringify(opts)}`;
  let f = df.get(k);
  if (!f) df.set(k, (f = new Intl.DateTimeFormat(locale, opts)));
  return f;
}

//---------------------------------------------------------------- helpers

const isBlank = (v: unknown) => v === null || v === undefined || v === '';

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'string' && v.trim() !== '') return Number(v);
  return NaN;
}

function toDate(v: unknown): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'string' && v.trim()) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const argNum = (a: unknown, d: number): number => {
  const n = typeof a === 'number' ? a : Number(a);
  return Number.isFinite(n) ? n : d;
};

//---------------------------------------------------------------- built-ins

registerFormatter('number', (v, a, l) => {
  const n = num(v);
  if (Number.isNaN(n)) return v;
  const min = a[0] === undefined ? undefined : argNum(a[0], 0);
  const max = a[1] === undefined ? undefined : argNum(a[1], 3);
  const opts: Intl.NumberFormatOptions = {};
  if (min !== undefined) opts.minimumFractionDigits = min;
  if (max !== undefined) opts.maximumFractionDigits = Math.max(max, min ?? 0);
  else if (min !== undefined) opts.maximumFractionDigits = Math.max(min, 3);
  return numberFormat(l, opts).format(n);
});

registerFormatter('currency', (v, a, l) => {
  const n = num(v);
  if (Number.isNaN(n)) return v;
  const currency = str(a[0]).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return numberFormat(l, {}).format(n);
  const display = ['symbol', 'narrowSymbol', 'code', 'name'].includes(str(a[1])) ? (str(a[1]) as Intl.NumberFormatOptions['currencyDisplay']) : undefined;
  return numberFormat(l, { style: 'currency', currency, currencyDisplay: display }).format(n);
});

registerFormatter('percent', (v, a, l) => {
  const n = num(v);
  if (Number.isNaN(n)) return v;
  const d = argNum(a[0], 0);
  return numberFormat(l, { style: 'percent', minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
});

registerFormatter('compact', (v, _a, l) => {
  const n = num(v);
  return Number.isNaN(n) ? v : numberFormat(l, { notation: 'compact' }).format(n);
});

const DATE_STYLES = ['short', 'medium', 'long', 'full'];
function dateLike(kind: 'date' | 'time' | 'datetime') {
  return (v: unknown, a: readonly unknown[], l: string | undefined) => {
    if (isBlank(v)) return '';
    const d = toDate(v);
    if (!d) return v;
    if (a[0] === 'iso') return d.toISOString();
    const style: 'short' | 'medium' | 'long' | 'full' = DATE_STYLES.includes(str(a[0])) ? (str(a[0]) as 'short' | 'medium' | 'long' | 'full') : 'medium';
    const timeStyle: 'short' | 'medium' = style === 'short' ? 'short' : 'medium';
    const opts: Intl.DateTimeFormatOptions =
      kind === 'date' ? { dateStyle: style } : kind === 'time' ? { timeStyle } : { dateStyle: style, timeStyle: 'short' };
    return dateFormat(l, opts).format(d);
  };
}
registerFormatter('date', dateLike('date'));
registerFormatter('time', dateLike('time'));
registerFormatter('datetime', dateLike('datetime'));

registerFormatter('upper', (v) => str(v).toUpperCase());
registerFormatter('lower', (v) => str(v).toLowerCase());
registerFormatter('trim', (v) => str(v).trim());
registerFormatter('capitalize', (v) => {
  const s = str(v);
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
});

registerFormatter('truncate', (v, a) => {
  const s = str(v);
  const n = Math.max(0, Math.trunc(argNum(a[0], 100)));
  if (s.length <= n) return s; // fast path: UTF-16 length is an upper bound of the code-point count
  const cps = Array.from(s); // do not cut an emoji / surrogate pair in half
  return cps.length <= n ? s : cps.slice(0, n).join('').trimEnd() + (a[1] === undefined ? '…' : str(a[1]));
});

registerFormatter('default', (v, a) => (isBlank(v) ? a[0] : v));
registerFormatter('join', (v, a) => (Array.isArray(v) ? v.map(str).join(a[0] === undefined ? ', ' : str(a[0])) : v));
registerFormatter('length', (v) => (typeof v === 'string' || Array.isArray(v) ? v.length : 0));
registerFormatter('json', (v) => JSON.stringify(v) ?? '');
registerFormatter('url', (v) => encodeURIComponent(str(v)));
registerFormatter('raw', (v) => new SafeString(str(v)));
registerFormatter('html', (v) => new SafeString(str(v)));

registerFormatter('stripTags', (v) => str(v).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim());

/** Keeps letters/numbers of ANY script (Persian slugs stay readable). */
registerFormatter('slug', (v) =>
  str(v)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, ''),
);

registerFormatter('plural', (v, a, l) => {
  const n = num(v);
  if (Number.isNaN(n)) return v;
  const key = l ?? 'en';
  let rules = pr.get(key);
  if (!rules) pr.set(key, (rules = new Intl.PluralRules(l)));
  const cat = rules.select(n);
  const [one, other, zero] = a;
  if (n === 0 && zero !== undefined) return str(zero);
  return cat === 'one' ? str(one) : str(other ?? one);
});
