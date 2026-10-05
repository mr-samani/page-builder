/**
 * منطق خالص (بدون Angular/DOM) کنترل Typography:
 * لیست فونت‌ها، وزن‌ها، تشخیص font-family فعلی، text-decoration و «truncate».
 */
import { splitTopLevel } from '../css-unit-field/css-value-utils';

//==================================================================================
// Fonts
//==================================================================================

export interface FontOption {
  label: string;
  /** مقدار کامل font-family (stack) */
  value: string;
  group: string;
}

export const DEFAULT_FONTS: FontOption[] = [
  { group: 'Generic', label: 'Inherit', value: 'inherit' },
  {
    group: 'Generic',
    label: 'System UI',
    value: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  { group: 'Generic', label: 'Sans-serif', value: 'sans-serif' },
  { group: 'Generic', label: 'Serif', value: 'serif' },
  { group: 'Generic', label: 'Monospace', value: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },

  { group: 'Sans-serif', label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { group: 'Sans-serif', label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { group: 'Sans-serif', label: 'Tahoma', value: 'Tahoma, Geneva, sans-serif' },
  { group: 'Sans-serif', label: 'Trebuchet MS', value: '"Trebuchet MS", Helvetica, sans-serif' },
  { group: 'Sans-serif', label: 'Segoe UI', value: '"Segoe UI", Tahoma, Geneva, sans-serif' },

  { group: 'Serif', label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
  { group: 'Serif', label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { group: 'Serif', label: 'Palatino', value: '"Palatino Linotype", Palatino, "Book Antiqua", serif' },

  { group: 'Monospace', label: 'Courier New', value: '"Courier New", Courier, monospace' },
  { group: 'Monospace', label: 'Consolas', value: 'Consolas, Monaco, monospace' },
];

/** اولین family از stack، بدون کوتیشن و با حروف کوچک: `"Trebuchet MS", sans` → `trebuchet ms` */
export function firstFamily(stack: string | undefined | null): string {
  const first = splitTopLevel((stack ?? '').trim(), ',')[0] ?? '';
  return first
    .replace(/^["']|["']$/g, '')
    .trim()
    .toLowerCase();
}

/** کدام گزینه با مقدار فعلی یکی است؟ (مقایسه با اولین family تا `Arial` قدیمی هم با `Arial, Helvetica, sans-serif` جور شود) */
export function findFont(options: readonly FontOption[], value: string | undefined | null): FontOption | undefined {
  const v = (value ?? '').trim();
  if (!v) return undefined;
  const exact = options.find((o) => o.value === v);
  if (exact) return exact;
  const ff = firstFamily(v);
  if (!ff) return undefined;
  return options.find((o) => firstFamily(o.value) === ff);
}

/** نام نمایشی برای مقدار نامشخص: اولین family */
export function fontLabelOf(value: string | undefined | null): string {
  const first = splitTopLevel((value ?? '').trim(), ',')[0] ?? '';
  return first.replace(/^["']|["']$/g, '').trim();
}

/** `var(--x)` یا `inherit` و ... نباید به‌عنوان نام فونت دست‌کاری شوند */
export const isVarValue = (v: string | undefined | null) => /^var\(/i.test((v ?? '').trim());

//==================================================================================
// Weight
//==================================================================================

export const WEIGHTS: { value: string; label: string }[] = [
  { value: '100', label: '100 – Thin' },
  { value: '200', label: '200 – Extra light' },
  { value: '300', label: '300 – Light' },
  { value: '400', label: '400 – Normal' },
  { value: '500', label: '500 – Medium' },
  { value: '600', label: '600 – Semi bold' },
  { value: '700', label: '700 – Bold' },
  { value: '800', label: '800 – Extra bold' },
  { value: '900', label: '900 – Black' },
];

/** normal→400 ، bold→700 تا با گزینه‌های عددی جور شوند */
export function normalizeWeight(v: string | undefined | null): string {
  const t = (v ?? '').trim().toLowerCase();
  if (t === 'normal') return '400';
  if (t === 'bold') return '700';
  return t;
}

//==================================================================================
// text-decoration
//==================================================================================

export type DecorationLine = 'none' | 'underline' | 'overline' | 'line-through';
const LINES = new Set<string>(['none', 'underline', 'overline', 'line-through']);

/**
 * خط تزئینی مؤثر: `text-decoration-line` اولویت دارد؛ وگرنه کلمه‌های خط در shorthand
 * (`underline dotted red` → `underline`). چند خط هم‌زمان («underline overline») → null = ساده نیست.
 */
export function effectiveDecorationLine(s: {
  textDecorationLine?: string;
  textDecoration?: string;
}): DecorationLine | '' | null {
  const src = (s.textDecorationLine || s.textDecoration || '').trim().toLowerCase();
  if (!src) return '';
  const found = splitTopLevel(src, ' ').filter((t) => LINES.has(t));
  if (found.length === 0) return '';
  if (found.length > 1) return null;
  return found[0] as DecorationLine;
}

//==================================================================================
// truncate (single-line ellipsis)
//==================================================================================

export function isTruncated(s: { overflow?: string; textOverflow?: string; whiteSpace?: string }): boolean {
  return s.textOverflow === 'ellipsis' && s.whiteSpace === 'nowrap' && s.overflow === 'hidden';
}

//==================================================================================
// text-align
//==================================================================================

/** start/end را بر اساس direction به left/right تبدیل می‌کند تا دکمه‌ی درست راهنما شود */
export function physicalAlign(align: string | undefined | null, direction: string | undefined | null): string {
  const a = (align ?? '').trim().toLowerCase();
  const rtl = (direction ?? '').trim().toLowerCase() === 'rtl';
  if (a === 'start') return rtl ? 'right' : 'left';
  if (a === 'end') return rtl ? 'left' : 'right';
  return a;
}

//==================================================================================
// color luminance (برای انتخاب پس‌زمینه‌ی خوانا در پیش‌نمایش)
//==================================================================================

const NAMED: Record<string, number> = { black: 0, white: 1 };

/** روشنایی نسبی ۰..۱ ؛ null اگر رنگ شفاف/نامشخص (var، currentcolor، ...) باشد */
export function colorLuminance(css: string | undefined | null): number | null {
  const t = (css ?? '').trim().toLowerCase();
  if (!t) return null;
  if (t in NAMED) return NAMED[t];

  let r: number,
    g: number,
    b: number,
    a = 1;
  const hex = /^#([0-9a-f]{3,8})$/.exec(t);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4)
      h = h
        .split('')
        .map((c) => c + c)
        .join('');
    if (h.length !== 6 && h.length !== 8) return null;
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
    if (h.length === 8) a = parseInt(h.slice(6, 8), 16) / 255;
  } else {
    const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(t);
    if (!m) return null;
    [r, g, b] = [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])];
    if (m[4] !== undefined) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  }
  if (a < 0.3) return null;
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
