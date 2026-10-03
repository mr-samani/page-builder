/**
 * ابزارهای خالص (بدون Angular/DOM) برای خواندن مقدارهای CSS.
 * همه‌ی پارسرهای transform / transition روی همین توابع ساخته شده‌اند.
 */

export interface CssNumber {
  num: number;
  unit: string;
}

const NUM_RE = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([a-z%]*)\s*$/i;

/** عدد را با حداکثر `digits` رقم اعشار و بدون صفرهای اضافی به متن تبدیل می‌کند (و -0 را 0 می‌کند) */
export function trimNum(n: number, digits = 4): string {
  const f = 10 ** digits;
  const r = Math.round(n * f) / f;
  return String(Object.is(r, -0) ? 0 : r);
}

/**
 * «20px» → {num:20, unit:'px'}.
 * - اگر `units` خالی باشد فقط عدد بدون واحد پذیرفته می‌شود (مثل scale).
 * - «0» بدون واحد مجاز است و واحد اول لیست را می‌گیرد.
 * - هرچیز دیگر (var()، calc()، واحد ناشناخته) → null یعنی «مقدار سفارشی».
 */
export function parseCssNumber(text: string | null | undefined, units: readonly string[]): CssNumber | null {
  if (text == null) return null;
  const m = NUM_RE.exec(String(text));
  if (!m) return null;
  const num = parseFloat(m[1]);
  if (!Number.isFinite(num)) return null;
  const unit = m[2].toLowerCase();

  if (units.length === 0) return unit === '' ? { num, unit: '' } : null;
  if (unit === '') return num === 0 ? { num, unit: units[0] } : null;
  const found = units.find((u) => u.toLowerCase() === unit);
  return found ? { num, unit: found } : null;
}

/** عدد خالص (با هر واحدی) را برمی‌گرداند؛ برای مقایسه‌هایی مثل «آیا صفر است؟» */
export function numericValueOf(text: string | null | undefined): number | null {
  if (text == null) return null;
  const m = NUM_RE.exec(String(text));
  return m ? parseFloat(m[1]) : null;
}

export function isZeroValue(text: string | null | undefined): boolean {
  return numericValueOf(text) === 0;
}

export function isOneValue(text: string | null | undefined): boolean {
  return numericValueOf(text) === 1;
}

/**
 * جداکردن در سطح بالا: کاما/فاصله‌هایی که داخل پرانتز یا کوتیشن‌اند
 * (var(--a, 1), cubic-bezier(.1,.2,.3,.4), url("a,b")) نادیده گرفته می‌شوند.
 */
export function splitTopLevel(text: string, sep: ',' | ' '): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  let quote = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')' && depth > 0) depth--;
    else if (depth === 0 && (sep === ',' ? ch === ',' : /\s/.test(ch))) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

export interface CssFunction {
  name: string;
  args: string[];
  /** متن کامل تابع، مثل `translate(10px, 5px)` */
  raw: string;
}

/** «translate(1px,2px) rotate(3deg)» → [{name:'translate', args:['1px','2px']}, ...]؛ اگر ساختار خراب باشد null */
export function parseFunctions(text: string): CssFunction[] | null {
  const s = text.trim();
  const out: CssFunction[] = [];
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;

    const nameStart = i;
    while (i < s.length && /[A-Za-z0-9_-]/.test(s[i])) i++;
    const name = s.slice(nameStart, i);
    if (!name || s[i] !== '(') return null;

    const innerStart = ++i;
    let depth = 1;
    let quote = '';
    for (; i < s.length && depth > 0; i++) {
      const ch = s[i];
      if (quote) {
        if (ch === '\\') i++;
        else if (ch === quote) quote = '';
        continue;
      }
      if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '(') depth++;
      else if (ch === ')') depth--;
    }
    if (depth !== 0) return null;

    const inner = s.slice(innerStart, i - 1);
    out.push({ name, args: splitTopLevel(inner, ','), raw: `${name}(${inner.trim()})` });
  }
  return out;
}

/**
 * برای پیش‌نمایش داخل خودِ ادیتور: `var(--x)` را با مقدار واقعی متغیر جایگزین می‌کند
 * (چون متغیرها فقط داخل iframe تعریف شده‌اند، نه در صفحه‌ی اصلی ادیتور).
 */
export function resolveCssVars(text: string, vars: readonly { name: string; value: string }[]): string {
  if (!text || !text.includes('var(') || !vars.length) return text;
  const map = new Map(vars.map((v) => [v.name, v.value]));
  let out = text;
  // چند دور تا متغیرهای تو در تو هم حل شوند؛ سقف دور برای جلوگیری از حلقه‌ی بی‌نهایت
  for (let round = 0; round < 4 && out.includes('var('); round++) {
    out = out.replace(/var\(\s*--([A-Za-z0-9_-]+)\s*(?:,\s*([^)]*))?\)/g, (_m, name: string, fb?: string) => {
      return map.get(name) ?? fb ?? '';
    });
  }
  return out;
}
