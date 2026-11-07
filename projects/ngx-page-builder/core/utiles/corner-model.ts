/**
 * مدل «Corners»: گوشه‌ی گرد (border-radius) + گوشه‌ی وارونه (inverted / concave corner) + فرورفتگی وسط لبه‌ها (notch).
 *
 * منطق خالص (بدون Angular/DOM) تا designer، preview و publish یکسان رفتار کنند.
 *
 * ── چطور کار می‌کند ─────────────────────────────────────────────────────────────
 *  - گوشه‌ی گرد   → `border-radius` معمولی.
 *  - گوشه‌ی وارونه → یک لایه‌ی `mask-image` با radial-gradient که یک ربع‌دایره‌ی شفاف در گوشه می‌اندازد.
 *  - notch         → یک قطعه‌ی دایره (circular segment) که از لبه به داخل بُریده می‌شود؛ با عرض/عمق/موقعیت.
 *  - لایه‌ها با `mask-composite: intersect` ترکیب می‌شوند، پس هر تعداد گوشه/notch کنار هم کار می‌کنند.
 *  - اندازه‌ها در custom property های `--pb-ci-*` / `--pb-cn-*` نگه‌داری می‌شوند (منبع حقیقت، پارس ساده)
 *    و با `@property` ثبت می‌شوند تا در hover/transition/animation نرم تغییر کنند.
 *
 * محدودیت‌های ذاتی mask: box-shadow و border در ناحیه‌ی بُریده‌شده دیده نمی‌شوند
 * (برای سایه، بلاک را داخل یک container با `filter: drop-shadow()` بگذارید).
 */

export type CornerKey = 'tl' | 'tr' | 'br' | 'bl';
export type EdgeKey = 't' | 'r' | 'b' | 'l';
export type CornerMode = 'round' | 'invert';

export const CORNER_KEYS: readonly CornerKey[] = ['tl', 'tr', 'br', 'bl'];
export const EDGE_KEYS: readonly EdgeKey[] = ['t', 'r', 'b', 'l'];

export interface CornerValue {
  mode: CornerMode;
  /** طول CSS مثل `24px` / `50%` (٪ فقط در حالت round) */
  size: string;
}

export interface NotchValue {
  on: boolean;
  /** عرض دهانه روی لبه (px) */
  width: number;
  /** عمق (px) */
  depth: number;
  /** موقعیت وسط notch روی لبه (٪) */
  pos: number;
}

export interface CornerModel {
  corners: Record<CornerKey, CornerValue>;
  notches: Record<EdgeKey, NotchValue>;
  /** border-radius بیضوی (`a / b`) که این کنترل نمی‌تواند به‌طور کامل نشان بدهد؛ تا وقتی کاربر دست نزده دست‌نخورده می‌ماند */
  elliptical: boolean;
}

//==================================================================================
// Names
//==================================================================================

export const INVERT_PROP: Record<CornerKey, string> = {
  tl: '--pb-ci-tl',
  tr: '--pb-ci-tr',
  br: '--pb-ci-br',
  bl: '--pb-ci-bl',
};

export const NOTCH_PROP: Record<EdgeKey, { r: string; d: string; x: string }> = {
  t: { r: '--pb-cn-t-r', d: '--pb-cn-t-d', x: '--pb-cn-t-x' },
  r: { r: '--pb-cn-r-r', d: '--pb-cn-r-d', x: '--pb-cn-r-x' },
  b: { r: '--pb-cn-b-r', d: '--pb-cn-b-d', x: '--pb-cn-b-x' },
  l: { r: '--pb-cn-l-r', d: '--pb-cn-l-d', x: '--pb-cn-l-x' },
};

const RADIUS_LONGHAND: Record<CornerKey, string> = {
  tl: 'border-top-left-radius',
  tr: 'border-top-right-radius',
  br: 'border-bottom-right-radius',
  bl: 'border-bottom-left-radius',
};

/** همه‌ی property هایی که این کنترل می‌نویسد (برای لیست transition و پاک‌سازی) */
export const CORNER_TRANSITION_PROPS: readonly string[] = [
  'border-radius',
  ...CORNER_KEYS.map((k) => INVERT_PROP[k]),
  ...EDGE_KEYS.flatMap((e) => [NOTCH_PROP[e].r, NOTCH_PROP[e].d, NOTCH_PROP[e].x]),
];

const AA = '.75px'; // نرمی لبه‌ی ماسک (anti-alias)
const CORNER_AT: Record<CornerKey, string> = { tl: '0 0', tr: '100% 0', br: '100% 100%', bl: '0 100%' };

//==================================================================================
// Defaults / factories
//==================================================================================

export const DEFAULT_INVERT_SIZE = '24px';
export const DEFAULT_ROUND_SIZE = '16px';
export const DEFAULT_NOTCH: NotchValue = { on: true, width: 72, depth: 28, pos: 50 };
export const OFF_NOTCH: NotchValue = { on: false, width: 72, depth: 28, pos: 50 };

export function createModel(): CornerModel {
  return {
    corners: {
      tl: { mode: 'round', size: '0px' },
      tr: { mode: 'round', size: '0px' },
      br: { mode: 'round', size: '0px' },
      bl: { mode: 'round', size: '0px' },
    },
    notches: { t: { ...OFF_NOTCH }, r: { ...OFF_NOTCH }, b: { ...OFF_NOTCH }, l: { ...OFF_NOTCH } },
    elliptical: false,
  };
}

export function cloneModel(m: CornerModel): CornerModel {
  return {
    corners: {
      tl: { ...m.corners.tl },
      tr: { ...m.corners.tr },
      br: { ...m.corners.br },
      bl: { ...m.corners.bl },
    },
    notches: { t: { ...m.notches.t }, r: { ...m.notches.r }, b: { ...m.notches.b }, l: { ...m.notches.l } },
    elliptical: m.elliptical,
  };
}

//==================================================================================
// Small helpers
//==================================================================================

/** تقسیم روی فاصله‌ی سطح‌بالا (داخل پرانتز مثل calc(1px + 2px) تقسیم نمی‌شود) */
function splitSpaces(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    else if (ch === ')' && depth > 0) depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (buf) out.push(buf);
      buf = '';
    } else buf += ch;
  }
  if (buf) out.push(buf);
  return out;
}

/** `border-radius: a b c d` (۱ تا ۴ مقدار) → [tl, tr, br, bl] */
function expandBox(tokens: string[]): [string, string, string, string] | null {
  switch (tokens.length) {
    case 1:
      return [tokens[0], tokens[0], tokens[0], tokens[0]];
    case 2:
      return [tokens[0], tokens[1], tokens[0], tokens[1]];
    case 3:
      return [tokens[0], tokens[1], tokens[2], tokens[1]];
    case 4:
      return [tokens[0], tokens[1], tokens[2], tokens[3]];
    default:
      return null;
  }
}

/** عدد px از `12px` / `12` / `0`؛ برای مقدارهای دیگر (var، calc، rem …) null */
export function pxOf(value: string | undefined | null): number | null {
  if (value == null) return null;
  const m = /^\s*(-?\d*\.?\d+)\s*(px)?\s*$/i.exec(value);
  return m ? parseFloat(m[1]) : null;
}

function normLen(v: string): string {
  const t = (v ?? '').trim();
  if (!t) return '0px';
  return /^-?\d*\.?\d+$/.test(t) ? `${+t}px` : t;
}

function isZero(v: string): boolean {
  const t = v.trim();
  return !t || /^0+(\.0+)?[a-z%]*$/i.test(t);
}

const r2 = (n: number) => +n.toFixed(2);

/** شعاع دایره‌ای که از دو سر دهانه‌ی `width` می‌گذرد و عمقش `depth` است */
export function notchRadius(width: number, depth: number): number {
  if (width <= 0 || depth <= 0) return 0;
  return (width * width / 4 + depth * depth) / (2 * depth);
}

/** عکس notchRadius: عرض دهانه از شعاع و عمق */
export function notchWidth(radius: number, depth: number): number {
  const v = 2 * radius * depth - depth * depth;
  return v > 0 ? 2 * Math.sqrt(v) : 0;
}

//==================================================================================
// Parse: declarations (kebab-case, مقدار «مؤثر») → model
//==================================================================================

export function parseCornerModel(decls: Record<string, string>): CornerModel {
  const m = createModel();

  // --- border-radius (shorthand سپس longhand ها)
  const radii: Record<CornerKey, string> = { tl: '0px', tr: '0px', br: '0px', bl: '0px' };
  const sh = (decls['border-radius'] ?? '').trim();
  if (sh) {
    const [h] = sh.split('/');
    if (sh.includes('/')) m.elliptical = true;
    const box = expandBox(splitSpaces(h));
    if (box) CORNER_KEYS.forEach((k, i) => (radii[k] = normLen(box[i])));
  }
  for (const k of CORNER_KEYS) {
    const lh = (decls[RADIUS_LONGHAND[k]] ?? '').trim();
    if (lh) radii[k] = normLen(lh.split(/\s+/)[0]);
  }

  for (const k of CORNER_KEYS) {
    const inv = (decls[INVERT_PROP[k]] ?? '').trim();
    m.corners[k] = inv ? { mode: 'invert', size: normLen(inv) } : { mode: 'round', size: radii[k] };
  }

  // --- notches
  for (const e of EDGE_KEYS) {
    const p = NOTCH_PROP[e];
    const dRaw = decls[p.d];
    if (dRaw === undefined || !dRaw.trim()) continue;
    const d = pxOf(dRaw) ?? 0;
    const r = pxOf(decls[p.r]) ?? 0;
    const x = parseFloat(decls[p.x] ?? '');
    m.notches[e] = { on: true, depth: d, width: r2(notchWidth(r, d)), pos: Number.isFinite(x) ? x : 50 };
  }
  return m;
}

//==================================================================================
// Serialize: model → declarations
//==================================================================================

export interface SerializeOptions {
  /** مقدار «مؤثر» هنگام لود (kebab-case) */
  loaded: Record<string, string>;
  /** آیا context فعلی از جای دیگری ارث می‌برد (breakpoint کوچک‌تر یا state)؟ */
  inherits: boolean;
  /** مقدار فعلی style (شامل ویرایش‌های همین نشست) — برای تشخیص mask ای که همین کنترل نوشته و باید پاک شود */
  current?: Record<string, string>;
}

/** لایه‌های ماسک به ترتیب ثابت: ۴ گوشه، سپس ۴ لبه */
export function buildMaskLayers(m: CornerModel): string[] {
  const layers: string[] = [];
  for (const k of CORNER_KEYS) {
    if (m.corners[k].mode !== 'invert') continue;
    const s = `var(${INVERT_PROP[k]},0px)`;
    layers.push(`radial-gradient(circle at ${CORNER_AT[k]},transparent ${s},#000 calc(${s} + ${AA}))`);
  }
  for (const e of EDGE_KEYS) {
    if (!m.notches[e].on) continue;
    const p = NOTCH_PROP[e];
    const r = `var(${p.r},0px)`;
    const d = `var(${p.d},0px)`;
    const x = `var(${p.x},50%)`;
    // مرکز دایره بیرون از لبه است؛ فاصله‌ی مرکز تا لبه = r − d
    const at =
      e === 't'
        ? `${x} calc(${d} - ${r})`
        : e === 'b'
          ? `${x} calc(100% - ${d} + ${r})`
          : e === 'l'
            ? `calc(${d} - ${r}) ${x}`
            : `calc(100% - ${d} + ${r}) ${x}`;
    layers.push(`radial-gradient(circle at ${at},transparent ${r},#000 calc(${r} + ${AA}))`);
  }
  return layers;
}

export function serializeCornerModel(m: CornerModel, opts: SerializeOptions): Record<string, string> {
  const out: Record<string, string> = {};
  const loaded = opts.loaded;
  /** «خاموش» کردن: اگر مقدار از بالادست ارث رسیده، با override صفر خنثی‌اش می‌کنیم؛ وگرنه حذف */
  const off = (prop: string) => (opts.inherits && (loaded[prop] ?? '') !== '' ? '0px' : '');

  // --- radius
  if (!m.elliptical) {
    const vals = CORNER_KEYS.map((k) => (m.corners[k].mode === 'round' ? normLen(m.corners[k].size) : '0'));
    const hadRadius = !!loaded['border-radius'] || CORNER_KEYS.some((k) => !!loaded[RADIUS_LONGHAND[k]]);
    if (vals.every(isZero)) out['border-radius'] = hadRadius && opts.inherits ? '0px' : '';
    else out['border-radius'] = vals.every((v) => v === vals[0]) ? vals[0] : vals.join(' ');
    for (const k of CORNER_KEYS) if (loaded[RADIUS_LONGHAND[k]]) out[RADIUS_LONGHAND[k]] = '';
  }

  // --- inverted corners
  for (const k of CORNER_KEYS) {
    out[INVERT_PROP[k]] = m.corners[k].mode === 'invert' ? normLen(m.corners[k].size) : off(INVERT_PROP[k]);
  }

  // --- notches
  for (const e of EDGE_KEYS) {
    const n = m.notches[e];
    const p = NOTCH_PROP[e];
    if (n.on) {
      const d = Math.max(0, r2(n.depth));
      out[p.d] = `${d}px`;
      out[p.r] = `${r2(notchRadius(Math.max(0, n.width), d))}px`;
      out[p.x] = `${r2(n.pos)}%`;
    } else {
      out[p.d] = off(p.d);
      out[p.r] = off(p.r);
      out[p.x] = '';
    }
  }

  // --- mask
  const layers = buildMaskLayers(m);
  const ownedMask = /--pb-c[in]-/.test(loaded['mask-image'] ?? '') || /--pb-c[in]-/.test(opts.current?.['mask-image'] ?? '');
  if (layers.length) {
    out['mask-image'] = layers.join(',');
    out['mask-composite'] = 'intersect';
  } else if (ownedMask) {
    out['mask-image'] = opts.inherits ? 'none' : '';
    out['mask-composite'] = '';
  }
  return out;
}

/** شیء declaration → متن CSS (برای پیش‌نمایش) */
export function declsToCssText(d: Record<string, string>): string {
  let s = '';
  for (const k of Object.keys(d)) if (d[k]) s += `${k}:${d[k]};`;
  return s;
}

//==================================================================================
// Presets
//==================================================================================

export interface CornerPreset {
  id: string;
  label: string;
  build: () => CornerModel;
}

function all(m: CornerModel, mode: CornerMode, size: string): CornerModel {
  for (const k of CORNER_KEYS) m.corners[k] = { mode, size };
  return m;
}

export const CORNER_PRESETS: readonly CornerPreset[] = [
  { id: 'sharp', label: 'Sharp', build: () => createModel() },
  { id: 'soft', label: 'Soft', build: () => all(createModel(), 'round', '14px') },
  { id: 'pill', label: 'Pill', build: () => all(createModel(), 'round', '999px') },
  { id: 'coupon', label: 'Coupon', build: () => all(createModel(), 'invert', '14px') },
  {
    id: 'ticket',
    label: 'Ticket',
    build: () => {
      const m = all(createModel(), 'round', '12px');
      m.notches.l = { on: true, width: 36, depth: 18, pos: 50 };
      m.notches.r = { on: true, width: 36, depth: 18, pos: 50 };
      return m;
    },
  },
  {
    id: 'diagonal',
    label: 'Diagonal',
    build: () => {
      const m = createModel();
      m.corners.tl = { mode: 'round', size: '28px' };
      m.corners.br = { mode: 'round', size: '28px' };
      m.corners.tr = { mode: 'invert', size: '28px' };
      m.corners.bl = { mode: 'invert', size: '28px' };
      return m;
    },
  },
  {
    id: 'scoop',
    label: 'Scoop',
    build: () => {
      const m = all(createModel(), 'round', '20px');
      m.corners.tl = { mode: 'invert', size: '44px' };
      return m;
    },
  },
  {
    id: 'cutout',
    label: 'Cut-out',
    build: () => {
      const m = all(createModel(), 'round', '20px');
      m.notches.b = { on: true, width: 96, depth: 30, pos: 50 };
      return m;
    },
  },
];

//==================================================================================
// @property registration (برای انیمیشن‌پذیر شدن اندازه‌ها)
//==================================================================================

interface PropDef {
  name: string;
  syntax: '<length>' | '<percentage>';
  initial: string;
}

const PROP_DEFS: readonly PropDef[] = [
  ...CORNER_KEYS.map((k): PropDef => ({ name: INVERT_PROP[k], syntax: '<length>', initial: '0px' })),
  ...EDGE_KEYS.flatMap((e): PropDef[] => [
    { name: NOTCH_PROP[e].r, syntax: '<length>', initial: '0px' },
    { name: NOTCH_PROP[e].d, syntax: '<length>', initial: '0px' },
    { name: NOTCH_PROP[e].x, syntax: '<percentage>', initial: '50%' },
  ]),
];

export function cornerPropertyRuleText(p: PropDef | string): string {
  const d = typeof p === 'string' ? PROP_DEFS.find((x) => x.name === p)! : p;
  return `@property ${d.name}{syntax:'${d.syntax}';inherits:false;initial-value:${d.initial}}`;
}

/** `@property` های لازم برای متن CSS داده‌شده (هر نام یک‌بار) */
export function usedCornerProperties(cssText: string | null | undefined): string[] {
  if (!cssText || !cssText.includes('--pb-c')) return [];
  return PROP_DEFS.filter((d) => cssText.includes(d.name + ':') || cssText.includes(`var(${d.name}`)).map((d) => d.name);
}

export function cornerPropertyCssFor(cssText: string | null | undefined): string {
  return usedCornerProperties(cssText).map(cornerPropertyRuleText).join('');
}
