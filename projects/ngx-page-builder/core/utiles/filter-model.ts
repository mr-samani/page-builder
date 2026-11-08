/**
 * filter-model.ts
 *
 * مدل کنترل «Filter»: فهرست مرتب‌شده‌ای از تابع‌های CSS filter
 * (blur, brightness, contrast, grayscale, hue-rotate, invert, opacity, saturate, sepia, drop-shadow)
 * به‌همراه parse / serialize و preset ها. برای `filter` و `backdrop-filter` یکسان است.
 *
 * ترتیب مهم است (filter ها به‌ترتیب اعمال می‌شوند)؛ تابع‌هایی که کنترل نمی‌شناسد
 * (url(#id)، var(...)، calc(...)) به‌صورت `raw` بدون تغییر حفظ می‌شوند.
 */

export type FilterFn =
  | 'blur'
  | 'brightness'
  | 'contrast'
  | 'grayscale'
  | 'hue-rotate'
  | 'invert'
  | 'opacity'
  | 'saturate'
  | 'sepia'
  | 'drop-shadow';

export type FilterProp = 'filter' | 'backdrop-filter';

export interface FilterMeta {
  fn: FilterFn;
  label: string;
  unit: 'px' | '%' | 'deg';
  min: number;
  max: number;
  /** بیشینه‌ی مجاز در فیلد عددی (اسلایدر تا max می‌رود) */
  hardMax?: number;
  step: number;
  /** مقدار خنثی (اثری ندارد) */
  neutral: number;
  /** مقدار آغازین هنگام افزودن */
  initial: number;
}

export const FILTER_META: Record<Exclude<FilterFn, 'drop-shadow'>, FilterMeta> & { 'drop-shadow': FilterMeta } = {
  blur: { fn: 'blur', label: 'Blur', unit: 'px', min: 0, max: 40, hardMax: 500, step: 0.5, neutral: 0, initial: 4 },
  brightness: { fn: 'brightness', label: 'Brightness', unit: '%', min: 0, max: 300, step: 1, neutral: 100, initial: 120 },
  contrast: { fn: 'contrast', label: 'Contrast', unit: '%', min: 0, max: 300, step: 1, neutral: 100, initial: 120 },
  grayscale: { fn: 'grayscale', label: 'Grayscale', unit: '%', min: 0, max: 100, step: 1, neutral: 0, initial: 100 },
  'hue-rotate': { fn: 'hue-rotate', label: 'Hue rotate', unit: 'deg', min: -360, max: 360, step: 1, neutral: 0, initial: 90 },
  invert: { fn: 'invert', label: 'Invert', unit: '%', min: 0, max: 100, step: 1, neutral: 0, initial: 100 },
  opacity: { fn: 'opacity', label: 'Opacity', unit: '%', min: 0, max: 100, step: 1, neutral: 100, initial: 70 },
  saturate: { fn: 'saturate', label: 'Saturate', unit: '%', min: 0, max: 400, step: 1, neutral: 100, initial: 150 },
  sepia: { fn: 'sepia', label: 'Sepia', unit: '%', min: 0, max: 100, step: 1, neutral: 0, initial: 80 },
  'drop-shadow': { fn: 'drop-shadow', label: 'Drop shadow', unit: 'px', min: 0, max: 0, step: 1, neutral: 0, initial: 0 },
};

export const FILTER_FNS = Object.keys(FILTER_META) as FilterFn[];

export interface ShadowValue {
  x: number;
  y: number;
  blur: number;
  /** رنگ به‌صورت #rrggbb (وقتی قابل‌تجزیه باشد) */
  color: string;
  /** ۰..۱ */
  alpha: number;
  /** رنگ ناشناخته (var(), currentColor, نام رنگ): بدون تغییر نوشته می‌شود تا وقتی کاربر رنگ را عوض کند */
  colorRaw?: string;
}

export interface FilterItem {
  id: number;
  kind: 'fn' | 'raw';
  fn?: FilterFn;
  /** مقدار عددی (واحد از FILTER_META) */
  value: number;
  shadow?: ShadowValue;
  /** متن اصلی برای kind=raw */
  raw?: string;
}

export interface FilterModel {
  items: FilterItem[];
}

export interface FilterPreset {
  id: string;
  label: string;
  build: () => FilterItem[];
}

export interface SerializeFilterOptions {
  prop: FilterProp;
  loaded: Record<string, string>;
  inherits: boolean;
}

//---------------------------------- helpers ----------------------------------

let uid = 1;
export const nextId = (): number => uid++;

const num = (n: number) => String(Math.round(n * 1000) / 1000);

export function createFilterModel(): FilterModel {
  return { items: [] };
}

export function cloneFilterModel(m: FilterModel): FilterModel {
  return {
    items: m.items.map((i) => ({ ...i, shadow: i.shadow ? { ...i.shadow } : undefined })),
  };
}

export const DEFAULT_SHADOW: ShadowValue = { x: 0, y: 4, blur: 8, color: '#000000', alpha: 0.4 };

export function createItem(fn: FilterFn): FilterItem {
  if (fn === 'drop-shadow') return { id: nextId(), kind: 'fn', fn, value: 0, shadow: { ...DEFAULT_SHADOW } };
  return { id: nextId(), kind: 'fn', fn, value: FILTER_META[fn].initial };
}

export function isNeutral(i: FilterItem): boolean {
  if (i.kind === 'raw') return false;
  if (i.fn === 'drop-shadow') return false;
  return i.value === FILTER_META[i.fn!].neutral;
}

//---------------------------------- parse ----------------------------------

/** تقسیم رشته‌ی filter به توکن‌های سطح‌بالا با رعایت پرانتزهای تودرتو */
export function splitTopLevel(src: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of src.trim()) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

/** عدد + واحد → عدد در واحد استاندارد تابع */
function toUnit(fn: Exclude<FilterFn, 'drop-shadow'>, arg: string): number | null {
  const m = /^(-?\d*\.?\d+)(px|%|deg|rad|grad|turn)?$/i.exec(arg.trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  const u = (m[2] ?? '').toLowerCase();
  const meta = FILTER_META[fn];
  switch (meta.unit) {
    case 'px':
      return u === '' || u === 'px' ? n : null;
    case 'deg':
      if (u === '' || u === 'deg') return n;
      if (u === 'rad') return (n * 180) / Math.PI;
      if (u === 'grad') return n * 0.9;
      if (u === 'turn') return n * 360;
      return null;
    default:
      // درصدی: brightness(1.2) ≡ brightness(120%)
      if (u === '%') return n;
      return u === '' ? n * 100 : null;
  }
}

export function parseColor(src: string): { color: string; alpha: number } | null {
  const s = src.trim().toLowerCase();
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length === 6) return { color: '#' + h, alpha: 1 };
    if (h.length === 8) return { color: '#' + h.slice(0, 6), alpha: Math.round((parseInt(h.slice(6), 16) / 255) * 100) / 100 };
    return null;
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%)?)?\s*\)$/.exec(s);
  if (m) {
    const hx = [m[1], m[2], m[3]].map((v) => Math.max(0, Math.min(255, Math.round(parseFloat(v)))).toString(16).padStart(2, '0'));
    let a = m[4] === undefined ? 1 : parseFloat(m[4]);
    if (m[5]) a /= 100;
    return { color: '#' + hx.join(''), alpha: Math.max(0, Math.min(1, a)) };
  }
  return null;
}

function parseShadow(arg: string): ShadowValue | null {
  // drop-shadow( [color] x y [blur] [color] )
  const parts = splitTopLevel(arg);
  const nums: number[] = [];
  let colorTok = '';
  for (const p of parts) {
    const n = /^(-?\d*\.?\d+)(px)?$/i.exec(p);
    if (n) nums.push(parseFloat(n[1]));
    else if (!colorTok) colorTok = p;
    else return null;
  }
  if (nums.length < 2 || nums.length > 3) return null;
  const pc = colorTok ? parseColor(colorTok) : { color: '#000000', alpha: 1 };
  const sh: ShadowValue = { x: nums[0], y: nums[1], blur: nums[2] ?? 0, color: pc?.color ?? '#000000', alpha: pc?.alpha ?? 1 };
  if (colorTok && !pc) sh.colorRaw = colorTok;
  return sh;
}

export function parseFilterModel(value: string | undefined | null): FilterModel {
  const m = createFilterModel();
  const v = (value ?? '').trim();
  if (!v || v === 'none') return m;
  for (const tok of splitTopLevel(v)) {
    const f = /^([a-z-]+)\((.*)\)$/i.exec(tok);
    const name = f?.[1].toLowerCase() as FilterFn | undefined;
    if (f && name && name in FILTER_META && name !== 'drop-shadow') {
      const val = toUnit(name as Exclude<FilterFn, 'drop-shadow'>, f[2]);
      if (val != null) {
        m.items.push({ id: nextId(), kind: 'fn', fn: name, value: val });
        continue;
      }
    } else if (f && name === 'drop-shadow') {
      const sh = parseShadow(f[2]);
      if (sh) {
        m.items.push({ id: nextId(), kind: 'fn', fn: 'drop-shadow', value: 0, shadow: sh });
        continue;
      }
    }
    m.items.push({ id: nextId(), kind: 'raw', value: 0, raw: tok });
  }
  return m;
}

//---------------------------------- serialize ----------------------------------

function colorText(s: ShadowValue): string {
  if (s.colorRaw) return s.colorRaw;
  if (s.alpha >= 1) return s.color;
  const h = s.color.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgb(${r} ${g} ${b} / ${num(s.alpha)})`;
}

export function itemToCss(i: FilterItem): string {
  if (i.kind === 'raw') return i.raw ?? '';
  const fn = i.fn!;
  if (fn === 'drop-shadow') {
    const s = i.shadow!;
    return `drop-shadow(${num(s.x)}px ${num(s.y)}px ${num(Math.max(0, s.blur))}px ${colorText(s)})`;
  }
  return `${fn}(${num(i.value)}${FILTER_META[fn].unit})`;
}

export function filterValue(items: readonly FilterItem[]): string {
  return items.map(itemToCss).filter(Boolean).join(' ');
}

/**
 * decls خروجی. `''` یعنی property حذف شود؛ در context های ارث‌بر که والد filter دارد
 * به‌جای حذف، `none` نوشته می‌شود تا واقعاً خاموش شود.
 */
export function serializeFilterModel(m: FilterModel, opt: SerializeFilterOptions): Record<string, string> {
  const v = filterValue(m.items);
  if (v) return { [opt.prop]: v };
  const had = !!opt.loaded?.[opt.prop] && opt.loaded[opt.prop] !== 'none';
  return { [opt.prop]: opt.inherits && had ? 'none' : '' };
}

export function filterDeclsToCssText(d: Record<string, string>): string {
  return Object.entries(d)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}

//---------------------------------- presets ----------------------------------

const fnItem = (fn: Exclude<FilterFn, 'drop-shadow'>, value: number): FilterItem => ({ id: nextId(), kind: 'fn', fn, value });

export const FILTER_PRESETS: FilterPreset[] = [
  { id: 'none', label: 'None', build: () => [] },
  { id: 'noir', label: 'Noir', build: () => [fnItem('grayscale', 100), fnItem('contrast', 130), fnItem('brightness', 90)] },
  { id: 'vintage', label: 'Vintage', build: () => [fnItem('sepia', 60), fnItem('contrast', 110), fnItem('brightness', 105), fnItem('saturate', 120)] },
  { id: 'vivid', label: 'Vivid', build: () => [fnItem('saturate', 160), fnItem('contrast', 110)] },
  { id: 'dream', label: 'Dream', build: () => [fnItem('blur', 1.5), fnItem('brightness', 110), fnItem('saturate', 130)] },
  { id: 'faded', label: 'Faded', build: () => [fnItem('contrast', 85), fnItem('brightness', 110), fnItem('saturate', 80)] },
  { id: 'cool', label: 'Cool', build: () => [fnItem('hue-rotate', 180), fnItem('saturate', 110)] },
  {
    id: 'glass',
    label: 'Glass',
    build: () => [fnItem('blur', 12), fnItem('saturate', 160), fnItem('brightness', 110)],
  },
  {
    id: 'shadow',
    label: 'Shadow',
    build: () => [{ id: nextId(), kind: 'fn', fn: 'drop-shadow', value: 0, shadow: { x: 0, y: 8, blur: 12, color: '#000000', alpha: 0.35 } }],
  },
  { id: 'invert', label: 'Invert', build: () => [fnItem('invert', 100), fnItem('hue-rotate', 180)] },
];
