/**
 * مدل transition: لیست لایه‌ها (property / duration / delay / easing) ↔ متن CSS.
 *
 * - هر آیتمی که نتوانیم با اطمینان بخوانیم (مثلاً var() یا calc() در زمان) به‌صورت `raw`
 *   نگه داشته و بدون تغییر دوباره نوشته می‌شود.
 * - فرم longhand (transition-property / -duration / -timing-function / -delay) هم خوانده می‌شود،
 *   چون از import یا Advanced ممکن است همین‌طور آمده باشد.
 */
import { splitTopLevel, trimNum } from '../css-unit-field/css-value-utils';

//==================================================================================
// Easing
//==================================================================================

export type Bezier = [number, number, number, number];
export type StepJump = 'jump-start' | 'jump-end' | 'jump-none' | 'jump-both' | 'start' | 'end';

export type ParsedEasing =
  | { kind: 'bezier'; p: Bezier }
  | { kind: 'steps'; n: number; jump: StepJump }
  | { kind: 'raw'; raw: string };

export const CSS_EASINGS: Record<string, Bezier> = {
  ease: [0.25, 0.1, 0.25, 1],
  linear: [0, 0, 1, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
};

export interface EasingPreset {
  id: string;
  label: string;
  group: string;
  p: Bezier;
}

const mk = (group: string, id: string, label: string, p: Bezier): EasingPreset => ({ id, label, group, p });

/** منحنی‌های استاندارد easings.net (+ پنج کلیدواژه‌ی CSS) */
export const EASING_PRESETS: EasingPreset[] = [
  mk('CSS', 'ease', 'Ease', CSS_EASINGS['ease']),
  mk('CSS', 'linear', 'Linear', CSS_EASINGS['linear']),
  mk('CSS', 'ease-in', 'Ease in', CSS_EASINGS['ease-in']),
  mk('CSS', 'ease-out', 'Ease out', CSS_EASINGS['ease-out']),
  mk('CSS', 'ease-in-out', 'Ease in out', CSS_EASINGS['ease-in-out']),

  mk('Sine', 'inSine', 'Ease in sine', [0.12, 0, 0.39, 0]),
  mk('Sine', 'outSine', 'Ease out sine', [0.61, 1, 0.88, 1]),
  mk('Sine', 'inOutSine', 'Ease in out sine', [0.37, 0, 0.63, 1]),

  mk('Quad', 'inQuad', 'Ease in quad', [0.11, 0, 0.5, 0]),
  mk('Quad', 'outQuad', 'Ease out quad', [0.5, 1, 0.89, 1]),
  mk('Quad', 'inOutQuad', 'Ease in out quad', [0.45, 0, 0.55, 1]),

  mk('Cubic', 'inCubic', 'Ease in cubic', [0.32, 0, 0.67, 0]),
  mk('Cubic', 'outCubic', 'Ease out cubic', [0.33, 1, 0.68, 1]),
  mk('Cubic', 'inOutCubic', 'Ease in out cubic', [0.65, 0, 0.35, 1]),

  mk('Quart', 'inQuart', 'Ease in quart', [0.5, 0, 0.75, 0]),
  mk('Quart', 'outQuart', 'Ease out quart', [0.25, 1, 0.5, 1]),
  mk('Quart', 'inOutQuart', 'Ease in out quart', [0.76, 0, 0.24, 1]),

  mk('Quint', 'inQuint', 'Ease in quint', [0.64, 0, 0.78, 0]),
  mk('Quint', 'outQuint', 'Ease out quint', [0.22, 1, 0.36, 1]),
  mk('Quint', 'inOutQuint', 'Ease in out quint', [0.83, 0, 0.17, 1]),

  mk('Expo', 'inExpo', 'Ease in expo', [0.7, 0, 0.84, 0]),
  mk('Expo', 'outExpo', 'Ease out expo', [0.16, 1, 0.3, 1]),
  mk('Expo', 'inOutExpo', 'Ease in out expo', [0.87, 0, 0.13, 1]),

  mk('Circ', 'inCirc', 'Ease in circ', [0.55, 0, 1, 0.45]),
  mk('Circ', 'outCirc', 'Ease out circ', [0, 0.55, 0.45, 1]),
  mk('Circ', 'inOutCirc', 'Ease in out circ', [0.85, 0, 0.15, 1]),

  mk('Back', 'inBack', 'Ease in back', [0.36, 0, 0.66, -0.56]),
  mk('Back', 'outBack', 'Ease out back', [0.34, 1.56, 0.64, 1]),
  mk('Back', 'inOutBack', 'Ease in out back', [0.68, -0.6, 0.32, 1.6]),
];

export const EASING_GROUPS: string[] = Array.from(new Set(EASING_PRESETS.map((p) => p.group)));

export const STEP_JUMPS: { value: StepJump; label: string }[] = [
  { value: 'end', label: 'End' },
  { value: 'start', label: 'Start' },
  { value: 'jump-both', label: 'Both' },
  { value: 'jump-none', label: 'None' },
];

const BEZIER_EPS = 0.0005;
const sameBezier = (a: Bezier, b: Bezier) => a.every((v, i) => Math.abs(v - b[i]) < BEZIER_EPS);

export function findPreset(p: Bezier): EasingPreset | undefined {
  return EASING_PRESETS.find((x) => sameBezier(x.p, p));
}

export function parseEasing(text: string | null | undefined): ParsedEasing {
  const t = (text ?? '').trim();
  const lower = t.toLowerCase();
  if (!t) return { kind: 'bezier', p: [...CSS_EASINGS['ease']] as Bezier };

  if (lower in CSS_EASINGS) return { kind: 'bezier', p: [...CSS_EASINGS[lower]] as Bezier };
  if (lower === 'step-start') return { kind: 'steps', n: 1, jump: 'start' };
  if (lower === 'step-end') return { kind: 'steps', n: 1, jump: 'end' };

  const cb = /^cubic-bezier\(\s*([^)]*)\)$/i.exec(t);
  if (cb) {
    const nums = cb[1].split(',').map((s) => Number(s.trim()));
    if (nums.length === 4 && nums.every((n) => Number.isFinite(n)) && nums[0] >= 0 && nums[0] <= 1 && nums[2] >= 0 && nums[2] <= 1) {
      return { kind: 'bezier', p: nums as Bezier };
    }
    return { kind: 'raw', raw: t };
  }

  const st = /^steps\(\s*(\d+)\s*(?:,\s*([a-z-]+)\s*)?\)$/i.exec(t);
  if (st) {
    let jump = (st[2]?.toLowerCase() ?? 'end') as StepJump;
    if (jump === 'jump-end') jump = 'end';
    if (jump === 'jump-start') jump = 'start';
    if (STEP_JUMPS.some((j) => j.value === jump)) {
      return { kind: 'steps', n: Math.max(1, parseInt(st[1], 10)), jump };
    }
  }
  return { kind: 'raw', raw: t };
}

export function formatEasing(e: ParsedEasing): string {
  switch (e.kind) {
    case 'bezier': {
      const kw = Object.keys(CSS_EASINGS).find((k) => sameBezier(CSS_EASINGS[k], e.p));
      return kw ?? `cubic-bezier(${e.p.map((n) => trimNum(n, 3)).join(', ')})`;
    }
    case 'steps':
      return `steps(${e.n}, ${e.jump})`;
    default:
      return e.raw;
  }
}

/** نام خوانا برای نمایش در لیست («Ease out cubic» یا «Custom») */
export function describeEasing(text: string): string {
  const e = parseEasing(text);
  if (e.kind === 'bezier') return findPreset(e.p)?.label ?? 'Custom curve';
  if (e.kind === 'steps') return `Steps ${e.n}`;
  return 'Custom';
}

/**
 * مسیر SVG منحنی داخل مستطیل w×h (برای آیکن کوچک ردیف‌ها). y برعکس است (۰ پایین).
 * `pad` فضای خالی دور منحنی است تا overshoot (back) بریده نشود.
 */
export function easingSvgPath(e: ParsedEasing, w: number, h: number, pad = 2): string {
  const x0 = pad;
  const x1 = w - pad;
  const y0 = h - pad;
  const y1 = pad;
  const X = (v: number) => +(x0 + v * (x1 - x0)).toFixed(2);
  const Y = (v: number) => +(y0 - v * (y0 - y1)).toFixed(2);

  if (e.kind === 'bezier') {
    const [a, b, c, d] = e.p;
    return `M${X(0)},${Y(0)} C${X(a)},${Y(b)} ${X(c)},${Y(d)} ${X(1)},${Y(1)}`;
  }
  if (e.kind === 'steps') {
    const n = Math.max(1, e.n);
    const seg = (i: number) => stepSegmentValue(i, n, e.jump);
    let d = `M${X(0)},${Y(0)}`;
    if (seg(0) > 0) d += ` L${X(0)},${Y(seg(0))}`;
    for (let i = 0; i < n; i++) {
      const x = X((i + 1) / n);
      d += ` L${x},${Y(seg(i))}`;
      const next = i < n - 1 ? seg(i + 1) : 1;
      if (next !== seg(i)) d += ` L${x},${Y(next)}`;
    }
    return d;
  }
  return `M${X(0)},${Y(0)} L${X(1)},${Y(1)}`;
}

/** مقدار خروجی (۰..۱) در بازه‌ی i‌ام از n بازه، طبق تعریف CSS برای هر نوع jump */
export function stepSegmentValue(i: number, n: number, jump: StepJump): number {
  switch (jump) {
    case 'start':
    case 'jump-start':
      return (i + 1) / n;
    case 'jump-none':
      return i / ((n - 1) || 1);
    case 'jump-both':
      return (i + 1) / (n + 1);
    default: // end / jump-end
      return i / n;
  }
}

//==================================================================================
// Transition layers
//==================================================================================

export interface TransitionLayer {
  uid: number;
  property: string;
  duration: string;
  delay: string;
  easing: string;
  /** اگر پر باشد، این آیتم قابل ویرایش ساختاری نیست و عیناً نوشته می‌شود */
  raw: string;
}

export const TRANSITION_DEFAULTS = { property: 'all', duration: '200ms', delay: '0ms', easing: 'ease' };

let uidCounter = 0;
export function createTransition(patch: Partial<Omit<TransitionLayer, 'uid'>> = {}): TransitionLayer {
  return { uid: ++uidCounter, ...TRANSITION_DEFAULTS, raw: '', ...patch };
}

const TIME_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:ms|s)$/i;
const IDENT_RE = /^(?:--[A-Za-z0-9_-]+|-?[A-Za-z_][A-Za-z0-9_-]*)$/;
const EASING_FN_RE = /^(?:cubic-bezier|steps|linear)\(/i;
const EASING_KW = new Set([...Object.keys(CSS_EASINGS), 'step-start', 'step-end']);

function parseItem(item: string): TransitionLayer | null {
  let property: string | undefined;
  let easing: string | undefined;
  const times: string[] = [];

  for (const tok of splitTopLevel(item, ' ')) {
    if (TIME_RE.test(tok)) {
      if (times.length >= 2) return null;
      times.push(tok);
    } else if (EASING_KW.has(tok.toLowerCase()) || EASING_FN_RE.test(tok)) {
      if (easing) return null;
      easing = tok;
    } else if (tok.includes('(')) {
      return null; // var() / calc() / env() ... → قابل تشخیص نیست
    } else if (IDENT_RE.test(tok)) {
      if (property) return null;
      property = tok;
    } else {
      return null;
    }
  }
  if (property?.toLowerCase() === 'none') return null;

  return createTransition({
    property: property ?? 'all',
    duration: times[0] ?? '0s',
    delay: times[1] ?? '0s',
    easing: easing ?? 'ease',
  });
}

/** مقدار shorthand را می‌خواند. `none`/خالی → [] */
export function parseTransitionShorthand(text: string | null | undefined): TransitionLayer[] {
  const t = (text ?? '').trim();
  if (!t || t.toLowerCase() === 'none') return [];
  return splitTopLevel(t, ',').map((item) => parseItem(item) ?? createTransition({ raw: item }));
}

export interface TransitionStyleLike {
  transition?: string;
  transitionProperty?: string;
  transitionDuration?: string;
  transitionTimingFunction?: string;
  transitionDelay?: string;
}

/** longhand ها: لیست‌ها طبق قاعده‌ی CSS به طول transition-property تکرار می‌شوند */
export function parseTransitionLonghands(s: TransitionStyleLike): TransitionLayer[] {
  const props = splitTopLevel(s.transitionProperty ?? '', ',');
  if (!props.length || (props.length === 1 && props[0].toLowerCase() === 'none')) return [];
  const dur = splitTopLevel(s.transitionDuration ?? '', ',');
  const ease = splitTopLevel(s.transitionTimingFunction ?? '', ',');
  const del = splitTopLevel(s.transitionDelay ?? '', ',');
  const at = (arr: string[], i: number, fb: string) => (arr.length ? arr[i % arr.length] : fb);

  return props.map((p, i) =>
    createTransition({
      property: p,
      duration: at(dur, i, '0s'),
      easing: at(ease, i, 'ease'),
      delay: at(del, i, '0s'),
    }),
  );
}

/** منبع واحد حقیقت: اگر shorthand هست همان، وگرنه longhand */
export function parseTransitionStyle(s: TransitionStyleLike): TransitionLayer[] {
  if (s.transition && s.transition.trim()) return parseTransitionShorthand(s.transition);
  if (s.transitionProperty && s.transitionProperty.trim()) return parseTransitionLonghands(s);
  return [];
}

export function serializeTransitionLayer(l: TransitionLayer): string {
  if (l.raw) return l.raw;
  const parts = [l.property || 'all', l.duration || '0ms', l.easing || 'ease'];
  // delay صفر را نمی‌نویسیم تا خروجی تمیز بماند
  const delay = (l.delay ?? '').trim();
  if (delay && !/^[+-]?0*\.?0+(?:ms|s)$/i.test(delay)) parts.push(delay);
  return parts.join(' ');
}

export function serializeTransition(layers: readonly TransitionLayer[]): string {
  return layers.map(serializeTransitionLayer).join(', ');
}

//==================================================================================
// Property list for the picker
//==================================================================================

export interface PropertyGroup {
  label: string;
  items: string[];
}

export const TRANSITION_PROPERTY_GROUPS: PropertyGroup[] = [
  { label: 'General', items: ['all', 'opacity', 'transform', 'filter', 'backdrop-filter', 'visibility'] },
  {
    label: 'Color',
    items: [
      'color',
      'background-color',
      'border-color',
      'outline-color',
      'fill',
      'stroke',
      'text-decoration-color',
    ],
  },
  { label: 'Border & shadow', items: ['border-width', 'border-radius', 'box-shadow', 'text-shadow', 'outline-offset'] },
  {
    label: 'Size & spacing',
    items: ['width', 'height', 'min-width', 'max-width', 'min-height', 'max-height', 'margin', 'padding', 'gap'],
  },
  { label: 'Position', items: ['top', 'right', 'bottom', 'left', 'inset', 'z-index'] },
  { label: 'Typography', items: ['font-size', 'font-weight', 'letter-spacing', 'line-height', 'word-spacing'] },
  { label: 'Other', items: ['background-position', 'background-size', 'clip-path', 'flex-basis', 'flex-grow', 'scale', 'rotate', 'translate'] },
];

export const ALL_KNOWN_PROPERTIES = new Set(TRANSITION_PROPERTY_GROUPS.flatMap((g) => g.items));

/** برای ورودی «Custom property» — فقط نام ساده یا --var */
export function isValidPropertyName(name: string): boolean {
  return IDENT_RE.test(name.trim()) && name.trim().toLowerCase() !== 'none';
}
