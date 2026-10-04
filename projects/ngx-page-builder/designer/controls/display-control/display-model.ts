/**
 * منطق خالص (بدون Angular/DOM) کنترل Display:
 * آیکن‌های جهت‌دار flex، نگاشت پد ۳×۳ ↔ justify/align، پارس track های grid،
 * پارس shorthand ـی flex و gap.
 */
import { parseCssNumber, parseFunctions, splitTopLevel, trimNum } from '../css-unit-field/css-value-utils';

//==================================================================================
// Glyphs (viewBox 16×16) — در حالت عمودی x/y جابه‌جا می‌شوند
//==================================================================================

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const transpose = (rects: Rect[], vertical: boolean): Rect[] =>
  vertical ? rects.map(({ x, y, w, h }) => ({ x: y, y: x, w: h, h: w })) : rects;

export type DistKind = 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly' | 'stretch';
export type CrossKind = 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';

/** سه میله روی محور اصلی با توزیع مشخص (justify-content). `vertical` یعنی محور اصلی عمودی است */
export function justifyGlyph(kind: DistKind, vertical = false): Rect[] {
  const w = 3;
  const h = 8;
  const y = 4;
  let xs: number[];
  switch (kind) {
    case 'center':
      xs = [2.5, 6.5, 10.5];
      break;
    case 'flex-end':
      xs = [4, 8, 12];
      break;
    case 'space-between':
      xs = [1, 6.5, 12];
      break;
    case 'space-around':
      xs = [1.83, 6.5, 11.17];
      break;
    case 'space-evenly':
      xs = [2.25, 6.5, 10.75];
      break;
    case 'stretch': {
      // میله‌های پهن‌تر که تمام فضا را پر می‌کنند
      const ww = 4.2;
      return transpose([1, 5.9, 10.8].map((x) => ({ x, y, w: ww, h })), vertical);
    }
    default:
      xs = [1, 5, 9];
  }
  return transpose(xs.map((x) => ({ x: r2(x), y, w, h })), vertical);
}

/** سه میله روی محور فرعی (align-items / align-self). `vertical` یعنی محور فرعی عمودی نیست (جهت column) */
export function alignGlyph(kind: CrossKind, vertical = false): Rect[] {
  const xs = [2.5, 6.5, 10.5];
  const hs = [5, 9, 7];
  const w = 3;
  let rects: Rect[];
  switch (kind) {
    case 'center':
      rects = xs.map((x, i) => ({ x, y: r2((16 - hs[i]) / 2), w, h: hs[i] }));
      break;
    case 'flex-end':
      rects = xs.map((x, i) => ({ x, y: 15 - hs[i], w, h: hs[i] }));
      break;
    case 'stretch':
      rects = xs.map((x) => ({ x, y: 1, w, h: 14 }));
      break;
    case 'baseline':
      rects = [
        ...xs.map((x, i) => ({ x, y: 4, w, h: hs[i] })),
        { x: 1, y: 5.6, w: 14, h: 0.9 }, // خط baseline
      ];
      break;
    default:
      rects = xs.map((x, i) => ({ x, y: 1, w, h: hs[i] }));
  }
  return transpose(rects, vertical);
}

//==================================================================================
// Pad 3×3 ↔ justify-content + align-items
//==================================================================================

export type FlexDirection = 'row' | 'row-reverse' | 'column' | 'column-reverse';
export const isVertical = (d: string) => d.startsWith('column');
export const isReverse = (d: string) => d.endsWith('reverse');

/** start/end/left/right → flex-start/flex-end (برای مقایسه) */
export function normalizePos(v: string | undefined | null): string {
  const t = (v ?? '').trim().toLowerCase();
  switch (t) {
    case 'start':
    case 'left':
    case 'self-start':
      return 'flex-start';
    case 'end':
    case 'right':
    case 'self-end':
      return 'flex-end';
    default:
      return t;
  }
}

const POS_INDEX: Record<string, number> = { 'flex-start': 0, center: 1, 'flex-end': 2 };
const POS_NAME = ['flex-start', 'center', 'flex-end'] as const;

/** سلول فعال پد؛ اگر مقدارها روی ۳×۳ نمی‌نشینند (between / stretch / baseline) → null */
export function padPosition(
  direction: string,
  justify: string | undefined,
  align: string | undefined,
): { col: number; row: number } | null {
  const main = POS_INDEX[normalizePos(justify) || 'flex-start'];
  const cross = POS_INDEX[normalizePos(align)];
  if (main === undefined || cross === undefined) return null;
  const m = isReverse(direction) ? 2 - main : main;
  return isVertical(direction) ? { col: cross, row: m } : { col: m, row: cross };
}

export function padToValues(direction: string, col: number, row: number): { justify: string; align: string } {
  const vertical = isVertical(direction);
  const m = vertical ? row : col;
  const cross = vertical ? col : row;
  const main = isReverse(direction) ? 2 - m : m;
  return { justify: POS_NAME[main], align: POS_NAME[cross] };
}

//==================================================================================
// Grid tracks
//==================================================================================

export interface Track {
  uid: number;
  value: string;
}

let uid = 0;
export const makeTrack = (value: string): Track => ({ uid: ++uid, value });

const TRACK_NUM_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:fr|px|%|em|rem|vw|vh|vmin|vmax|ch|ex|pt|cm|mm|in)$/i;
const TRACK_KW = new Set(['auto', 'min-content', 'max-content']);
const TRACK_FN_RE = /^(?:minmax|fit-content|var|calc|clamp|min|max)\(/i;
const MAX_TRACKS = 200;

function validTrack(tok: string): boolean {
  const t = tok.trim();
  if (!t || t.includes('[') || t.includes(']')) return false;
  return TRACK_NUM_RE.test(t) || t === '0' || TRACK_KW.has(t.toLowerCase()) || TRACK_FN_RE.test(t);
}

/**
 * grid-template-columns/rows → لیست track.
 * `repeat(N, ...)` با N عددی باز می‌شود. هرچه پشتیبانی نمی‌شود (auto-fill/auto-fit، نام خط‌ها [a]، subgrid، masonry) → null
 * تا UI به حالت متنی برود و چیزی خراب نشود.
 */
export function parseTracks(text: string | null | undefined): Track[] | null {
  const t = (text ?? '').trim();
  if (!t || t.toLowerCase() === 'none') return [];
  const out: string[] = [];

  for (const tok of splitTopLevel(t, ' ')) {
    if (/^repeat\(/i.test(tok)) {
      const fn = parseFunctions(tok);
      if (!fn || fn.length !== 1 || fn[0].args.length !== 2) return null;
      const n = fn[0].args[0].trim();
      if (!/^\d+$/.test(n)) return null; // auto-fill / auto-fit
      const inner = splitTopLevel(fn[0].args[1], ' ');
      if (!inner.length || !inner.every(validTrack)) return null;
      const count = parseInt(n, 10);
      if (count < 1 || count * inner.length > MAX_TRACKS) return null;
      for (let i = 0; i < count; i++) out.push(...inner);
    } else if (validTrack(tok)) {
      out.push(tok);
    } else {
      return null;
    }
    if (out.length > MAX_TRACKS) return null;
  }
  return out.map(makeTrack);
}

/** run های ≥۴تایی یکسان به repeat() فشرده می‌شوند (۱۲ ستونه‌ی خوانا)؛ لیست خالی → none */
export function serializeTracks(tracks: readonly Track[]): string {
  if (!tracks.length) return 'none';
  const parts: string[] = [];
  for (let i = 0; i < tracks.length; ) {
    let j = i;
    while (j < tracks.length && tracks[j].value === tracks[i].value) j++;
    const n = j - i;
    if (n >= 4) parts.push(`repeat(${n}, ${tracks[i].value})`);
    else for (let k = 0; k < n; k++) parts.push(tracks[i].value);
    i = j;
  }
  return parts.join(' ');
}

/** وزن نسبی برای پیش‌نمایش کوچک (نه محاسبه‌ی واقعی grid) */
export function trackWeight(value: string): number {
  const n = parseCssNumber(value, ['fr', 'px', '%', 'em', 'rem', 'vw', 'vh']);
  if (!n) return 1;
  const clamp = (v: number) => Math.min(3, Math.max(0.25, v));
  switch (n.unit) {
    case 'fr':
      return clamp(n.num);
    case 'px':
      return clamp(n.num / 120);
    case '%':
      return clamp(n.num / 33);
    case 'em':
    case 'rem':
      return clamp((n.num * 16) / 120);
    default:
      return 1;
  }
}

export function trackLabel(value: string): string {
  const n = /^([+-]?(?:\d+\.?\d*|\.\d+))([a-z%]+)$/i.exec(value.trim());
  return n ? `${trimNum(parseFloat(n[1]))}${n[2].toUpperCase()}` : value.trim();
}

export interface GridPreset {
  id: string;
  label: string;
  columns: string;
}
export const GRID_PRESETS: GridPreset[] = [
  { id: '2', label: '2', columns: '1fr 1fr' },
  { id: '3', label: '3', columns: '1fr 1fr 1fr' },
  { id: '4', label: '4', columns: '1fr 1fr 1fr 1fr' },
  { id: 'side', label: 'Sidebar', columns: '240px 1fr' },
  { id: 'auto', label: 'Auto-fit', columns: 'repeat(auto-fit, minmax(200px, 1fr))' },
];
const squash = (s: string) => s.trim().replace(/\s+/g, ' ');
export function findGridPreset(columns: string | undefined): GridPreset | undefined {
  const c = squash(columns ?? '');
  return GRID_PRESETS.find((p) => p.columns === c);
}

//==================================================================================
// flex shorthand / sizing
//==================================================================================

export interface FlexParts {
  grow: string;
  shrink: string;
  basis: string;
}

const NUM_ONLY = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;
const LEN_OR_KW = /^(?:[+-]?(?:\d+\.?\d*|\.\d+)(?:px|%|em|rem|vw|vh|ch|ex|vmin|vmax)|auto|content|min-content|max-content|fit-content)$/i;

/** `flex: ...` را طبق مشخصات CSS به grow/shrink/basis می‌شکند؛ هرچه نامطمئن است (var() و ...) → null */
export function parseFlexShorthand(text: string | null | undefined): FlexParts | null {
  const t = (text ?? '').trim().toLowerCase();
  if (!t) return null;
  if (t === 'none') return { grow: '0', shrink: '0', basis: 'auto' };
  if (t === 'auto') return { grow: '1', shrink: '1', basis: 'auto' };
  if (t === 'initial') return { grow: '0', shrink: '1', basis: 'auto' };

  const toks = splitTopLevel(t, ' ');
  if (toks.length === 1) {
    if (NUM_ONLY.test(toks[0])) return { grow: toks[0], shrink: '1', basis: '0%' };
    if (LEN_OR_KW.test(toks[0])) return { grow: '1', shrink: '1', basis: toks[0] };
    return null;
  }
  if (toks.length === 2) {
    if (!NUM_ONLY.test(toks[0])) return null;
    if (NUM_ONLY.test(toks[1])) return { grow: toks[0], shrink: toks[1], basis: '0%' };
    if (LEN_OR_KW.test(toks[1])) return { grow: toks[0], shrink: '1', basis: toks[1] };
    return null;
  }
  if (toks.length === 3 && NUM_ONLY.test(toks[0]) && NUM_ONLY.test(toks[1]) && LEN_OR_KW.test(toks[2])) {
    return { grow: toks[0], shrink: toks[1], basis: toks[2] };
  }
  return null;
}

export type FlexSizing = 'fixed' | 'shrink' | 'grow' | 'custom';
export const FLEX_PRESETS: Record<Exclude<FlexSizing, 'custom'>, FlexParts> = {
  fixed: { grow: '0', shrink: '0', basis: 'auto' },
  shrink: { grow: '0', shrink: '1', basis: 'auto' },
  grow: { grow: '1', shrink: '1', basis: '0%' },
};

const isZeroBasis = (b: string) => /^0(?:px|%)?$/i.test(b.trim());

export function detectSizing(p: FlexParts): FlexSizing {
  const g = Number(p.grow);
  const s = Number(p.shrink);
  const auto = p.basis.trim().toLowerCase() === 'auto';
  if (g === 0 && s === 0 && auto) return 'fixed';
  if (g === 0 && s === 1 && auto) return 'shrink';
  if (g === 1 && s === 1 && isZeroBasis(p.basis)) return 'grow';
  return 'custom';
}

/** مقدار مؤثر از longhand ها (اولویت) یا shorthand؛ پیش‌فرض‌های CSS */
export function effectiveFlex(s: { flex?: string; flexGrow?: string; flexShrink?: string; flexBasis?: string }): {
  parts: FlexParts;
  isSet: boolean;
} {
  const sh = parseFlexShorthand(s.flex);
  const isSet = !!(s.flexGrow || s.flexShrink || s.flexBasis || s.flex);
  return {
    isSet,
    parts: {
      grow: s.flexGrow || sh?.grow || '0',
      shrink: s.flexShrink || sh?.shrink || '1',
      basis: s.flexBasis || sh?.basis || 'auto',
    },
  };
}

//==================================================================================
// gap
//==================================================================================

export interface GapParts {
  row: string;
  col: string;
  split: boolean;
}

/** row-gap / column-gap بر `gap` غلبه دارند؛ `gap: A B` یعنی row=A و column=B */
export function parseGap(s: { gap?: string; rowGap?: string; columnGap?: string }): GapParts {
  const g = splitTopLevel((s.gap ?? '').trim(), ' ');
  const row = s.rowGap || g[0] || '';
  const col = s.columnGap || g[1] || g[0] || '';
  return { row, col, split: row !== col };
}

//==================================================================================
// span (grid-column / grid-row)
//==================================================================================

/** '' → 0 (auto)، 'span 3' → 3، هر چیز دیگر (مثل '1 / 3') → null = ساده نیست */
export function parseSpan(v: string | undefined | null): number | null {
  const t = (v ?? '').trim().toLowerCase();
  if (!t || t === 'auto') return 0;
  const m = /^span\s+(\d+)$/.exec(t);
  return m ? parseInt(m[1], 10) : null;
}
export const spanValue = (n: number): string => (n <= 0 ? '' : `span ${n}`);
