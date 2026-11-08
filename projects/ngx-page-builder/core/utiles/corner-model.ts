/**
 * corner-model.ts  (v2)
 *
 * مدل شکل گوشه‌ها و Notch ها + تبدیل به CSS.
 *
 * روش خروجی: «mask-image با SVG data-URI» (روش ۳ سایت corner-inverter) ولی ارتقا‌یافته:
 *   - SVG اندازه‌ی ذاتی ندارد و با `mask-size: 100% 100%` دقیقاً روی المنت کشیده می‌شود،
 *   - هر قطعه‌ی هندسی (گوشه / notch) با <svg x y overflow=visible> به گوشه یا لبه‌ی خودش «لنگر» می‌شود
 *     و داخلش مختصات px مطلق است؛ پس شعاع‌ها روی هر اندازه‌ی المنت دقیقاً px می‌مانند (بدون aspect-ratio و بدون کشیدگی)،
 *   - عرض/ارتفاع برش‌ها می‌تواند px یا % باشد.
 *
 * گوشه‌ی ساده‌ی گرد (round) همچنان با `border-radius` ساخته می‌شود.
 */

export type CornerKey = 'tl' | 'tr' | 'br' | 'bl';
export type EdgeKey = 't' | 'r' | 'b' | 'l';
export type CornerMode = 'round' | 'scoop' | 'cut';
export type NotchShape = 'rect' | 'round';

export const CORNER_KEYS: readonly CornerKey[] = ['tl', 'tr', 'br', 'bl'];
export const EDGE_KEYS: readonly EdgeKey[] = ['t', 'r', 'b', 'l'];
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
export const DEFAULT_ROUND_SIZE = '12px';
/** اندازه‌ی آغازین گوشه‌ی scoop */
export const DEFAULT_INVERT_SIZE = '16px';

/** برش مستطیلی در گوشه (مثل خروجی corner-inverter). w / h به px یا % ؛ شعاع‌ها px */
export interface CutValue {
  w: string;
  h: string;
  /** شعاع راس روی لبه‌ی افقی (محدب) */
  r1: number;
  /** شعاع راس داخلی (مقعر) */
  r2: number;
  /** شعاع راس روی لبه‌ی عمودی (محدب) */
  r3: number;
  /** وقتی true باشد r1=r2=r3 و فقط r1 ویرایش می‌شود */
  linked: boolean;
}
/** همه‌ی property هایی که این کنترل می‌نویسد (برای لیست transition و پاک‌سازی) */
export const CORNER_TRANSITION_PROPS: readonly string[] = [
  'border-radius',
  ...CORNER_KEYS.map((k) => INVERT_PROP[k]),
  ...EDGE_KEYS.flatMap((e) => [NOTCH_PROP[e].r, NOTCH_PROP[e].d, NOTCH_PROP[e].x]),
];

export interface CornerValue {
  mode: CornerMode;
  /** round: شعاع border-radius ؛ scoop: شعاع دایره‌ی فرورفته */
  size: string;
  cut: CutValue;
}

export interface NotchValue {
  on: boolean;
  shape: NotchShape;
  /** px */
  width: number;
  /** px */
  depth: number;
  /** ٪ در امتداد لبه */
  pos: number;
  /** شعاع دو گوشه‌ی ته notch (فقط shape=rect) */
  radius: number;
  /** شعاع دو راس محدب روی لبه (نرم کردن ورودی notch) */
  flare: number;
}

export interface CornerModel {
  corners: Record<CornerKey, CornerValue>;
  notches: Record<EdgeKey, NotchValue>;
  /** border-radius بیضوی (a / b) که در Advanced تنظیم شده؛ دست‌نخورده حفظ می‌شود */
  elliptical: boolean;
  ellipticalRaw: string;
}

export interface CornerPreset {
  id: string;
  label: string;
  build: () => CornerModel;
}

export interface SerializeOptions {
  /** مقدار مؤثر هنگام لود (شامل ارث‌بری) */
  loaded: Record<string, string>;
  /** آیا context فعلی از جای دیگری ارث می‌برد؟ */
  inherits: boolean;
  current?: Record<string, string>;
}

export const PROP_MODEL = '--pb-corners';
const LEGACY_PREFIXES = ['--pb-ci-', '--pb-cn-'];

//---------------------------------- factories ----------------------------------

export const DEFAULT_CUT: CutValue = { w: '40px', h: '24px', r1: 8, r2: 8, r3: 8, linked: true };

export const DEFAULT_NOTCH: NotchValue = {
  on: true,
  shape: 'rect',
  width: 64,
  depth: 20,
  pos: 50,
  radius: 8,
  flare: 8,
};

export function createCorner(): CornerValue {
  return { mode: 'round', size: '0px', cut: { ...DEFAULT_CUT } };
}

export function createModel(): CornerModel {
  const corners = {} as Record<CornerKey, CornerValue>;
  for (const k of CORNER_KEYS) corners[k] = createCorner();
  const notches = {} as Record<EdgeKey, NotchValue>;
  for (const e of EDGE_KEYS) notches[e] = { ...DEFAULT_NOTCH, on: false };
  return { corners, notches, elliptical: false, ellipticalRaw: '' };
}

export function cloneModel(m: CornerModel): CornerModel {
  const n = createModel();
  for (const k of CORNER_KEYS) n.corners[k] = { ...m.corners[k], cut: { ...m.corners[k].cut } };
  for (const e of EDGE_KEYS) n.notches[e] = { ...m.notches[e] };
  n.elliptical = m.elliptical;
  n.ellipticalRaw = m.ellipticalRaw;
  return n;
}

//---------------------------------- units ----------------------------------

export function pxOf(v: string | null | undefined): number | null {
  const m = /^\s*(-?\d*\.?\d+)\s*(px)?\s*$/i.exec(v ?? '');
  return m ? parseFloat(m[1]) : null;
}

export interface Len {
  /** سهم درصدی */
  pct: number;
  /** سهم px */
  px: number;
}

/** فقط px و % برای هندسه‌ی SVG معنی دارد؛ بقیه‌ی واحدها px فرض می‌شوند */
export function parseLen(v: string): Len {
  const s = (v ?? '').trim();
  const p = /^(-?\d*\.?\d+)%$/.exec(s);
  if (p) return { pct: parseFloat(p[1]), px: 0 };
  const n = parseFloat(s);
  return { pct: 0, px: Number.isFinite(n) ? n : 0 };
}

const num = (n: number) => String(Math.round(n * 1000) / 1000);
const isZero = (v: string) => !v.trim() || /^0+(\.0+)?[a-z%]*$/i.test(v.trim());

//---------------------------------- SVG geometry ----------------------------------

/**
 * مختصات یک محور: `a%` + `b px` از لبه‌ی «خودِ» گوشه به سمت داخل.
 * خروجی: ویژگی‌ی x/y برای <svg> لنگر + translate داخلی.
 */
function anchorAxis(len: Len, farSide: boolean): { at: string; shift: number } {
  return farSide ? { at: `${num(100 - len.pct)}%`, shift: -len.px } : { at: `${num(len.pct)}%`, shift: len.px };
}

/**
 * محتوای `content` را در نقطه‌ی (fx, fy) (از گوشه‌ی corner به سمت داخل) قرار می‌دهد.
 * مختصات محلی: +x به سمت داخل (برای گوشه‌های راست آینه می‌شود)، +y به سمت پایین/بالا مشابه.
 */
function placeAtCorner(c: CornerKey, fx: Len, fy: Len, content: string, mirror = true): string {
  const farX = c[1] === 'r';
  const farY = c[0] === 'b';
  const ax = anchorAxis(fx, farX);
  const ay = anchorAxis(fy, farY);
  const sx = mirror && farX ? -1 : 1;
  const sy = mirror && farY ? -1 : 1;
  return (
    `<svg x='${ax.at}' y='${ay.at}' overflow='visible'>` +
    `<g transform='translate(${num(ax.shift)} ${num(ay.shift)}) scale(${sx} ${sy})'>${content}</g></svg>`
  );
}

const ZERO: Len = { pct: 0, px: 0 };

/** برش مستطیلی گوشه (مختصات محلی گوشه‌ی بالا-چپ) */
function cutShapes(c: CornerKey, cut: CutValue): string {
  const w = parseLen(cut.w);
  const h = parseLen(cut.h);
  const r1 = Math.max(0, cut.r1);
  const r2 = Math.max(0, cut.linked ? cut.r1 : cut.r2);
  const r3 = Math.max(0, cut.linked ? cut.r1 : cut.r3);
  const widthAttr = w.pct ? `${num(w.pct)}%` : num(w.px);
  const heightAttr = h.pct ? `${num(h.pct)}%` : num(h.px);
  const rect = `<rect x='0' y='0' width='${widthAttr}' height='${heightAttr}'/>`;

  const body = placeAtCorner(c, ZERO, ZERO, rect);

  // راس‌ها (patch). هرکدام با 1px هم‌پوشانی با مستطیل تا درز AA نیفتد.
  let patches = '';
  if (r1 > 0) {
    patches += placeAtCorner(
      c,
      { pct: w.pct, px: w.px },
      ZERO,
      `<path d='M-1 0H${num(r1)}A${num(r1)} ${num(r1)} 0 0 0 0 ${num(r1)}H-1Z'/>`,
    );
  }
  if (r3 > 0) {
    patches += placeAtCorner(
      c,
      ZERO,
      { pct: h.pct, px: h.px },
      `<path d='M0 -1H${num(r3)}V0A${num(r3)} ${num(r3)} 0 0 0 0 ${num(r3)}Z'/>`,
    );
  }
  // پرکننده‌ی مقعر: ماده‌ی شکل را برمی‌گرداند (سفید)
  let fillet = '';
  if (r2 > 0) {
    fillet = placeAtCorner(
      c,
      { pct: w.pct, px: w.px },
      { pct: h.pct, px: h.px },
      `<path fill='#fff' d='M0 0H${num(-r2)}A${num(r2)} ${num(r2)} 0 0 0 0 ${num(-r2)}Z'/>`,
    );
  }
  return `<g fill='#000'>${body}${patches}</g>${fillet}`;
}

/** scoop: ربع‌دایره‌ی فرورفته در گوشه */
function scoopShapes(c: CornerKey, size: string): string {
  const s = Math.max(0, parseLen(size).px);
  if (!s) return '';
  return `<g fill='#000'>${placeAtCorner(c, ZERO, ZERO, `<path d='M0 0H${num(s)}A${num(s)} ${num(s)} 0 0 1 0 ${num(s)}Z'/>`)}</g>`;
}

/** notch روی یک لبه. مختصات محلی: مبدأ وسط notch روی لبه، +y به سمت داخل */
function notchShapes(e: EdgeKey, n: NotchValue): string {
  const w = Math.max(0, n.width);
  const d = Math.max(0, n.depth);
  if (!w || !d) return '';
  const pos = Math.min(100, Math.max(0, n.pos));
  const hw = w / 2;
  const flare = Math.max(0, n.flare);
  const ri = Math.min(Math.max(0, n.radius), hw, d);

  let pocket: string;
  if (n.shape === 'round') {
    pocket = `<path d='M${num(-hw)} -1V0A${num(hw)} ${num(d)} 0 0 0 ${num(hw)} 0V-1Z'/>`;
  } else {
    pocket =
      `<path d='M${num(-hw)} -1V${num(d - ri)}` +
      (ri
        ? `A${num(ri)} ${num(ri)} 0 0 0 ${num(-hw + ri)} ${num(d)}H${num(hw - ri)}A${num(ri)} ${num(ri)} 0 0 0 ${num(hw)} ${num(d - ri)}`
        : `H${num(hw)}`) +
      `V-1Z'/>`;
  }
  let flares = '';
  if (flare > 0) {
    const f = num(flare);
    flares =
      `<path d='M1 0H${num(-flare)}A${f} ${f} 0 0 1 0 ${f}H1Z' transform='translate(${num(-hw)} 0)'/>` +
      `<path d='M-1 0H${f}A${f} ${f} 0 0 0 0 ${f}H-1Z' transform='translate(${num(hw)} 0)'/>`;
  }
  const inner = `<g fill='#000'>${pocket}${flares}</g>`;

  // لنگر: برای لبه‌های t/b موقعیت در امتداد x ؛ برای l/r در امتداد y
  const horizontal = e === 't' || e === 'b';
  const far = e === 'b' || e === 'r';
  const along = `${num(pos)}%`;
  const edgeAt = far ? '100%' : '0%';
  // نگاشت محلی (x در امتداد لبه، +y به داخل) → سراسری
  const rot = {
    t: '',
    b: "transform='matrix(1 0 0 -1 0 0)'",
    l: "transform='matrix(0 1 1 0 0 0)'",
    r: "transform='matrix(0 1 -1 0 0 0)'",
  }[e];
  const x = horizontal ? along : edgeAt;
  const y = horizontal ? edgeAt : along;
  return `<svg x='${x}' y='${y}' overflow='visible'><g ${rot}>${inner}</g></svg>`;
}

/** SVG کامل ماسک (فقط ناحیه‌های خالی با رنگ مشکی روی زمینه‌ی سفید) */
export function buildMaskSvg(m: CornerModel): string {
  let voids = '';
  for (const k of CORNER_KEYS) {
    const c = m.corners[k];
    if (c.mode === 'cut') voids += cutShapes(k, c.cut);
    else if (c.mode === 'scoop') voids += scoopShapes(k, c.size);
  }
  for (const e of EDGE_KEYS) if (m.notches[e].on) voids += notchShapes(e, m.notches[e]);

  return (
    `<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%'>` +
    `<mask id='m' maskUnits='userSpaceOnUse' x='0' y='0' width='100%' height='100%'>` +
    `<rect width='100%' height='100%' fill='#fff'/>${voids}</mask>` +
    `<rect width='100%' height='100%' fill='#000' mask='url(#m)'/></svg>`
  );
}

function svgToUrl(svg: string): string {
  const enc = svg
    .replace(/%/g, '%25')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
    .replace(/#/g, '%23')
    .replace(/"/g, "'");
  return `url("data:image/svg+xml,${enc}")`;
}

//---------------------------------- persistence ----------------------------------

const CK = { round: 'r', scoop: 's', cut: 'c' } as const;
const CK_REV: Record<string, CornerMode> = { r: 'round', s: 'scoop', c: 'cut' };

/** قالب فشرده: v2;tl=r:12px;tr=c:70px,20px,4,4,4,1;...;t=n:r,64,20,50,8,8 */
export function encodeModel(m: CornerModel): string {
  const parts = ['v2'];
  for (const k of CORNER_KEYS) {
    const c = m.corners[k];
    if (c.mode === 'cut') {
      const u = c.cut;
      parts.push(`${k}=c:${u.w},${u.h},${num(u.r1)},${num(u.r2)},${num(u.r3)},${u.linked ? 1 : 0}`);
    } else parts.push(`${k}=${CK[c.mode]}:${c.size}`);
  }
  for (const e of EDGE_KEYS) {
    const n = m.notches[e];
    if (n.on)
      parts.push(
        `${e}=n:${n.shape === 'round' ? 'o' : 'r'},${num(n.width)},${num(n.depth)},${num(n.pos)},${num(n.radius)},${num(n.flare)}`,
      );
  }
  return parts.join(';');
}

export function decodeModel(src: string): CornerModel | null {
  const s = src.trim().replace(/^["']|["']$/g, '');
  if (!s.startsWith('v2')) return null;
  const m = createModel();
  for (const part of s.split(';').slice(1)) {
    const [key, rest] = part.split('=');
    if (!rest) continue;
    const [kind, payload = ''] = rest.split(':');
    const a = payload.split(',');
    if ((CORNER_KEYS as readonly string[]).includes(key)) {
      const c = m.corners[key as CornerKey];
      c.mode = CK_REV[kind] ?? 'round';
      if (c.mode === 'cut') {
        c.cut = {
          w: a[0] || '0px',
          h: a[1] || '0px',
          r1: +a[2] || 0,
          r2: +a[3] || 0,
          r3: +a[4] || 0,
          linked: a[5] === '1',
        };
        c.size = DEFAULT_INVERT_SIZE;
      } else c.size = payload || '0px';
    } else if ((EDGE_KEYS as readonly string[]).includes(key) && kind === 'n') {
      m.notches[key as EdgeKey] = {
        on: true,
        shape: a[0] === 'o' ? 'round' : 'rect',
        width: +a[1] || 0,
        depth: +a[2] || 0,
        pos: a[3] === undefined ? 50 : +a[3],
        radius: +a[4] || 0,
        flare: +a[5] || 0,
      };
    }
  }
  return m;
}

/** border-radius (۱ تا ۴ مقدار) → چهار گوشه [tl, tr, br, bl] */
function expandRadius(v: string): string[] | null {
  const t = v.trim().split(/\s+/).filter(Boolean);
  if (!t.length || t.length > 4) return null;
  const [a, b = a, c = a, d = b] = t;
  return [a, b, c, d];
}

export function parseCornerModel(decls: Record<string, string>): CornerModel {
  const fromVar = decodeModel(decls[PROP_MODEL] ?? '');
  const m = fromVar ?? createModel();
  const br = (decls['border-radius'] ?? '').trim();
  if (br.includes('/')) {
    m.elliptical = true;
    m.ellipticalRaw = br;
  } else if (!fromVar && br) {
    const q = expandRadius(br);
    if (q) CORNER_KEYS.forEach((k, i) => (m.corners[k].size = q[i]));
  } else if (fromVar && br) {
    // مقادیر border-radius جدیدتر از Advanced را برای گوشه‌های round بپذیر
    const q = expandRadius(br);
    if (q) CORNER_KEYS.forEach((k, i) => m.corners[k].mode === 'round' && (m.corners[k].size = q[i]));
  }
  return m;
}

//---------------------------------- serialize ----------------------------------

const MASK_PROPS = ['mask-image', 'mask-size', 'mask-repeat', 'mask-position'] as const;

/** مقدارهایی که اگر مدل خالی بود باید پاک (یا در حالت ارث‌بری «خنثی») شوند */
export function serializeCornerModel(m: CornerModel, opt: SerializeOptions): Record<string, string> {
  const out: Record<string, string> = {};
  const loaded = opt.loaded ?? {};

  // --- border-radius ---
  if (m.elliptical) {
    out['border-radius'] = m.ellipticalRaw;
  } else {
    const vals = CORNER_KEYS.map((k) => {
      const c = m.corners[k];
      return c.mode === 'round' && !isZero(c.size) ? c.size : '0px';
    });
    const any = vals.some((v) => !isZero(v));
    if (any) {
      const [a, b, c, d] = vals;
      out['border-radius'] = a === b && b === c && c === d ? a : `${a} ${b} ${c} ${d}`;
    } else
      out['border-radius'] = opt.inherits && loaded['border-radius'] && !isZero(loaded['border-radius']) ? '0px' : '';
  }

  // --- mask ---
  const usesMask = CORNER_KEYS.some((k) => m.corners[k].mode !== 'round') || EDGE_KEYS.some((e) => m.notches[e].on);
  if (usesMask) {
    out['mask-image'] = svgToUrl(buildMaskSvg(m));
    out['mask-size'] = '100% 100%';
    out['mask-repeat'] = 'no-repeat';
    out['mask-position'] = '0 0';
    out[PROP_MODEL] = `"${encodeModel(m)}"`;
  } else {
    const hadMask = !!loaded['mask-image'] && loaded['mask-image'] !== 'none';
    for (const p of MASK_PROPS) out[p] = '';
    if (opt.inherits && hadMask) out['mask-image'] = 'none';
    out[PROP_MODEL] = '';
  }
  // پاک‌سازی متغیرهای نسخه‌ی قدیمی (--pb-ci-* / --pb-cn-*) و mask قدیمی
  for (const key of Object.keys(loaded)) if (LEGACY_PREFIXES.some((p) => key.startsWith(p))) out[key] = '';
  return out;
}

/** decls → متن CSS (مقدارهای خالی نادیده گرفته می‌شوند) */
export function declsToCssText(d: Record<string, string>): string {
  return Object.entries(d)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}

//---------------------------------- presets ----------------------------------

const rnd = (px: number): CornerValue => ({ ...createCorner(), mode: 'round', size: `${px}px` });
const scoop = (px: number): CornerValue => ({ ...createCorner(), mode: 'scoop', size: `${px}px` });
const cut = (w: string, h: string, r: number | [number, number, number]): CornerValue => {
  const [r1, r2, r3] = Array.isArray(r) ? r : [r, r, r];
  return {
    ...createCorner(),
    mode: 'cut',
    size: DEFAULT_INVERT_SIZE,
    cut: { w, h, r1, r2, r3, linked: r1 === r2 && r2 === r3 },
  };
};
const model = (f: (m: CornerModel) => void): CornerModel => {
  const m = createModel();
  f(m);
  return m;
};

export const CORNER_PRESETS: CornerPreset[] = [
  { id: 'none', label: 'None', build: () => createModel() },
  { id: 'round', label: 'Round', build: () => model((m) => CORNER_KEYS.forEach((k) => (m.corners[k] = rnd(16)))) },
  { id: 'pill', label: 'Pill', build: () => model((m) => CORNER_KEYS.forEach((k) => (m.corners[k] = rnd(999)))) },
  { id: 'scoop', label: 'Scoop', build: () => model((m) => CORNER_KEYS.forEach((k) => (m.corners[k] = scoop(18)))) },
  {
    id: 'ticket',
    label: 'Ticket',
    build: () =>
      model((m) => {
        CORNER_KEYS.forEach((k) => (m.corners[k] = rnd(8)));
        m.notches.l = { ...DEFAULT_NOTCH, shape: 'round', width: 24, depth: 12, pos: 50, radius: 0, flare: 0 };
        m.notches.r = { ...DEFAULT_NOTCH, shape: 'round', width: 24, depth: 12, pos: 50, radius: 0, flare: 0 };
      }),
  },
  {
    id: 'tab',
    label: 'Tab',
    build: () =>
      model((m) => {
        m.corners.tl = rnd(10);
        m.corners.bl = rnd(10);
        m.corners.br = rnd(10);
        m.corners.tr = cut('60%', '22px', 8);
      }),
  },
  {
    id: 'bite',
    label: 'Bite',
    build: () =>
      model((m) => {
        CORNER_KEYS.forEach((k) => (m.corners[k] = rnd(10)));
        m.corners.br = cut('36px', '28px', [8, 10, 8]);
      }),
  },
  {
    id: 'island',
    label: 'Island',
    build: () =>
      model((m) => {
        CORNER_KEYS.forEach((k) => (m.corners[k] = rnd(14)));
        m.notches.t = { ...DEFAULT_NOTCH, width: 72, depth: 18, pos: 50, radius: 9, flare: 10 };
      }),
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
  return PROP_DEFS.filter((d) => cssText.includes(d.name + ':') || cssText.includes(`var(${d.name}`)).map(
    (d) => d.name,
  );
}

export function cornerPropertyCssFor(cssText: string | null | undefined): string {
  return usedCornerProperties(cssText).map(cornerPropertyRuleText).join('');
}
