/**
 * border-model.ts
 *
 * مدل کنترل «Border» (به‌همراه Outline): عرض / سبک / رنگ برای هر ضلع.
 *
 * - ورودی parse: نقشه‌ی declaration ها (kebab-case) — همان چیزی که CSSStyleHelper.styleObjectToDecls می‌دهد.
 *   shorthand ها (`border`، `border-top`، `border-width: 1px 2px`، ...) و longhand ها همه خوانده می‌شوند.
 *   اولویت (مثل نویسنده‌ی معمولی CSS): border < border-width/style/color < border-{side} < border-{side}-{prop}
 * - خروجی serialize: همیشه همان فرم «canonical» → `border-width` ، `border-style` ، `border-color`
 *   (۱ تا ۴ مقداری، کوتاه‌ترین فرم). shorthand / longhand های دیگر با `''` پاک می‌شوند تا دو منبع حقیقت نداشته باشیم.
 * - `border-radius` عمداً اینجا نیست؛ مال کنترل Corners است.
 */
import { splitTopLevel } from 'ngx-page-builder/core';

export type BorderSideKey = 'top' | 'right' | 'bottom' | 'left';
export type BorderTarget = 'all' | BorderSideKey;
export type BorderProp = 'width' | 'style' | 'color';

export const BORDER_SIDES: readonly BorderSideKey[] = ['top', 'right', 'bottom', 'left'];
export const BORDER_PROPS: readonly BorderProp[] = ['width', 'style', 'color'];

export const BORDER_STYLES = ['none', 'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset', 'hidden'] as const;
export const OUTLINE_STYLES = ['none', 'auto', 'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset'] as const;
export const WIDTH_KEYWORDS = ['thin', 'medium', 'thick'] as const;

const BORDER_STYLE_SET: ReadonlySet<string> = new Set(BORDER_STYLES);
const OUTLINE_STYLE_SET: ReadonlySet<string> = new Set(OUTLINE_STYLES);
const WIDTH_KW_SET: ReadonlySet<string> = new Set(WIDTH_KEYWORDS);
const CSS_WIDE: ReadonlySet<string> = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer']);

export interface BorderSide {
  /** `1px` ، `thin` ، `var(--w)` ... ('' = ست‌نشده) */
  width: string;
  style: string;
  color: string;
}

export type BorderModel = Record<BorderSideKey, BorderSide>;

export interface OutlineModel {
  width: string;
  style: string;
  color: string;
  offset: string;
}

export interface SerializeOptions {
  /** declaration های لودشده (برای تصمیم «خاموش کردن» در context های ارث‌بر) */
  loaded: Record<string, string>;
  /** آیا context فعلی (breakpoint کوچک‌تر یا state) از جای دیگری ارث می‌برد؟ */
  inherits: boolean;
}

//---------------------------------- factories ----------------------------------

const emptySide = (): BorderSide => ({ width: '', style: '', color: '' });

export const createBorderModel = (): BorderModel => ({
  top: emptySide(),
  right: emptySide(),
  bottom: emptySide(),
  left: emptySide(),
});

export const createOutlineModel = (): OutlineModel => ({ width: '', style: '', color: '', offset: '' });

export function cloneBorderModel(m: BorderModel): BorderModel {
  return { top: { ...m.top }, right: { ...m.right }, bottom: { ...m.bottom }, left: { ...m.left } };
}

export const cloneOutlineModel = (o: OutlineModel): OutlineModel => ({ ...o });

//---------------------------------- queries ----------------------------------

const NO_STYLE: ReadonlySet<string> = new Set(['', 'none', 'hidden']);

/** آیا این ضلع واقعاً خطی می‌کشد؟ */
export const sideVisible = (s: BorderSide): boolean => !NO_STYLE.has(s.style.toLowerCase());

/** آیا چیزی (حتی ناقص) روی هر ضلعی ست شده؟ */
export const hasBorder = (m: BorderModel): boolean => BORDER_SIDES.some((k) => !!(m[k].width || m[k].style || m[k].color));

export const isBorderVisible = (m: BorderModel): boolean => BORDER_SIDES.some((k) => sideVisible(m[k]));

export const hasOutline = (o: OutlineModel): boolean => !!(o.width || o.style || o.color || o.offset);

//---------------------------------- parse ----------------------------------

const LENGTH_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[a-z%]+)?$/i;
const FN_WIDTH_RE = /^(?:calc|min|max|clamp)\(/i;

function classify(tok: string, styles: ReadonlySet<string>): BorderProp {
  const t = tok.toLowerCase();
  if (styles.has(t)) return 'style';
  if (WIDTH_KW_SET.has(t) || LENGTH_RE.test(t) || FN_WIDTH_RE.test(t)) return 'width';
  // رنگ‌ها و هر چیز مبهم (var(--x)، rgb()، #hex، نام رنگ، currentcolor)
  return 'color';
}

/**
 * `border` / `border-top` / `outline`: «عرض سبک رنگ» به هر ترتیب. null = قابل‌فهم نیست (دست‌نخورده می‌ماند).
 * توجه: shorthand همه‌ی سه جزء را ریست می‌کند، پس جزء‌های نیامده '' می‌شوند.
 */
function parseShorthand(v: string | undefined, styles: ReadonlySet<string>): BorderSide | null {
  const src = (v ?? '').trim();
  if (!src) return null;
  const toks = splitTopLevel(src);
  if (!toks.length || toks.length > 3) return null;
  if (toks.length === 1 && CSS_WIDE.has(toks[0].toLowerCase())) return null;
  const out = emptySide();
  for (const tok of toks) {
    const k = classify(tok, styles);
    if (out[k]) return null;
    out[k] = k === 'style' ? tok.toLowerCase() : tok;
  }
  return out;
}

/** مقدار ۱ تا ۴ تایی (مثل `border-width: 1px 2px`) → [top, right, bottom, left] */
export function expand4(v: string | undefined): string[] | null {
  const t = splitTopLevel((v ?? '').trim());
  if (!t.length || t.length > 4) return null;
  if (t.length === 1 && CSS_WIDE.has(t[0].toLowerCase())) return null;
  const [a, b = a, c = a, d = b] = t;
  return [a, b, c, d];
}

/** [top, right, bottom, left] → کوتاه‌ترین فرم CSS */
export function collapse4(vals: readonly string[]): string {
  const [t, r, b, l] = vals;
  if (t === r && r === b && b === l) return t;
  if (t === b && r === l) return `${t} ${r}`;
  if (r === l) return `${t} ${r} ${b}`;
  return `${t} ${r} ${b} ${l}`;
}

export function parseBorderModel(d: Record<string, string>): BorderModel {
  const m = createBorderModel();

  // 1) border
  const all = parseShorthand(d['border'], BORDER_STYLE_SET);
  if (all) for (const s of BORDER_SIDES) m[s] = { ...all };

  // 2) border-width / border-style / border-color
  for (const p of BORDER_PROPS) {
    const arr = expand4(d[`border-${p}`]);
    if (arr) BORDER_SIDES.forEach((s, i) => (m[s][p] = p === 'style' ? arr[i].toLowerCase() : arr[i]));
  }

  // 3) border-{side}
  for (const s of BORDER_SIDES) {
    const sh = parseShorthand(d[`border-${s}`], BORDER_STYLE_SET);
    if (sh) m[s] = sh;
  }

  // 4) border-{side}-{prop}
  for (const s of BORDER_SIDES) {
    for (const p of BORDER_PROPS) {
      const v = d[`border-${s}-${p}`]?.trim();
      if (v) m[s][p] = p === 'style' ? v.toLowerCase() : v;
    }
  }
  return m;
}

export function parseOutlineModel(d: Record<string, string>): OutlineModel {
  const o = createOutlineModel();
  const sh = parseShorthand(d['outline'], OUTLINE_STYLE_SET);
  if (sh) {
    o.width = sh.width;
    o.style = sh.style;
    o.color = sh.color;
  }
  if (d['outline-width']?.trim()) o.width = d['outline-width'].trim();
  if (d['outline-style']?.trim()) o.style = d['outline-style'].trim().toLowerCase();
  if (d['outline-color']?.trim()) o.color = d['outline-color'].trim();
  if (d['outline-offset']?.trim()) o.offset = d['outline-offset'].trim();
  return o;
}

//---------------------------------- serialize ----------------------------------

/** مقدار پیش‌فرض CSS برای جزءهای ست‌نشده، وقتی ضلع‌های دیگر آن property را دارند */
const DEFAULTS: Record<BorderProp, string> = { width: 'medium', style: 'none', color: 'currentcolor' };

/**
 * decls خروجی (kebab-case). `''` یعنی property حذف شود.
 * اگر مدل خالی است ولی context از جای دیگری ارث می‌برد و آن‌جا خط دیده می‌شود، `border-style: none` نوشته می‌شود
 * تا واقعاً خاموش شود (حذف override فقط مقدار ارث‌بری‌شده را برمی‌گرداند).
 */
export function serializeBorderModel(m: BorderModel, opt: SerializeOptions): Record<string, string> {
  const out: Record<string, string> = { border: '' };
  for (const s of BORDER_SIDES) {
    out[`border-${s}`] = '';
    for (const p of BORDER_PROPS) out[`border-${s}-${p}`] = '';
  }
  for (const p of BORDER_PROPS) {
    const vals = BORDER_SIDES.map((s) => m[s][p]);
    out[`border-${p}`] = vals.every((v) => !v) ? '' : collapse4(vals.map((v) => v || DEFAULTS[p]));
  }
  if (!hasBorder(m) && opt.inherits && isBorderVisible(parseBorderModel(opt.loaded))) {
    out['border-style'] = 'none';
  }
  return out;
}

export function serializeOutlineModel(o: OutlineModel, opt: SerializeOptions): Record<string, string> {
  const out: Record<string, string> = {
    outline: '',
    'outline-width': o.width,
    'outline-style': o.style,
    'outline-color': o.color,
    'outline-offset': o.offset,
  };
  if (!hasOutline(o) && opt.inherits) {
    const had = parseOutlineModel(opt.loaded).style;
    if (had && had !== 'none') out['outline-style'] = 'none';
  }
  return out;
}

export function declsToCssText(d: Record<string, string>): string {
  return Object.entries(d)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}

//---------------------------------- presets ----------------------------------

export interface BorderPreset {
  id: string;
  label: string;
  /** `color` = رنگ فعلی کاربر ('' = currentcolor) تا با عوض کردن preset رنگ از دست نرود */
  build: (color: string) => BorderModel;
}

const uniform = (width: string, style: string, color: string): BorderModel => {
  const side: BorderSide = { width, style, color };
  return { top: { ...side }, right: { ...side }, bottom: { ...side }, left: { ...side } };
};

export const BORDER_PRESETS: BorderPreset[] = [
  { id: 'none', label: 'None', build: () => createBorderModel() },
  { id: 'hairline', label: 'Hairline', build: (c) => uniform('1px', 'solid', c) },
  { id: 'thick', label: 'Thick', build: (c) => uniform('3px', 'solid', c) },
  { id: 'dashed', label: 'Dashed', build: (c) => uniform('2px', 'dashed', c) },
  { id: 'dotted', label: 'Dotted', build: (c) => uniform('2px', 'dotted', c) },
  { id: 'double', label: 'Double', build: (c) => uniform('4px', 'double', c) },
  {
    id: 'underline',
    label: 'Underline',
    build: (c) => {
      const m = createBorderModel();
      m.bottom = { width: '1px', style: 'solid', color: c };
      return m;
    },
  },
  {
    id: 'accent',
    label: 'Accent',
    build: (c) => {
      const m = createBorderModel();
      m.left = { width: '4px', style: 'solid', color: c };
      return m;
    },
  },
];

/** «شکل» مدل بدون رنگ؛ برای تشخیص preset فعال (رنگ را کاربر جدا انتخاب می‌کند) */
export function borderShape(m: BorderModel): string {
  return BORDER_SIDES.map((s) => `${m[s].width}|${m[s].style}`).join(',');
}
