/**
 * مدل animation: لیست لایه‌ها (name / duration / easing / delay / iterations / direction / fill / play-state) ↔ متن CSS.
 *
 * - همان قرارداد transition-model: هر آیتمی که با اطمینان نخوانیم (var()، calc()، نام مبهم و ...)
 *   به‌صورت `raw` نگه داشته و بدون تغییر دوباره نوشته می‌شود.
 * - فرم longhand (animation-name / -duration / ...) هم خوانده می‌شود (import یا Advanced).
 * - نام keyframes: یا یکی از پریست‌های `pb-*` (core/utiles/animation-keyframes) یا نام keyframes ی خود کاربر.
 */
import { AnimationPresetDefaults } from 'ngx-page-builder/core';
import { splitTopLevel } from '../css-unit-field/css-value-utils';
import { CSS_EASINGS } from '../transition-control/transition-model';

export const ANIMATION_DIRECTIONS = ['normal', 'reverse', 'alternate', 'alternate-reverse'] as const;
export const ANIMATION_FILLS = ['none', 'forwards', 'backwards', 'both'] as const;
export const ANIMATION_PLAY_STATES = ['running', 'paused'] as const;

export interface AnimationLayer {
  uid: number;
  name: string;
  duration: string;
  delay: string;
  easing: string;
  /** عدد یا `infinite` */
  iterations: string;
  direction: string;
  fill: string;
  playState: string;
  /** اگر پر باشد، این آیتم قابل ویرایش ساختاری نیست و عیناً نوشته می‌شود */
  raw: string;
}

export const ANIMATION_DEFAULTS = {
  name: 'pb-fade-in',
  duration: '600ms',
  delay: '0ms',
  easing: 'ease',
  iterations: '1',
  direction: 'normal',
  fill: 'both',
  playState: 'running',
};

let uidCounter = 0;
export function createAnimation(patch: Partial<Omit<AnimationLayer, 'uid'>> = {}): AnimationLayer {
  return { uid: ++uidCounter, ...ANIMATION_DEFAULTS, raw: '', ...patch };
}

/** پریست‌ها فقط کلیدهایی را که تعریف کرده‌اند عوض می‌کنند (مثلاً spin → linear + infinite) */
export function applyPresetDefaults(d: AnimationPresetDefaults | undefined): Partial<Omit<AnimationLayer, 'uid'>> {
  const patch: Partial<Omit<AnimationLayer, 'uid'>> = {
    iterations: d?.iterations ?? '1',
    direction: d?.direction ?? 'normal',
    fill: d?.fill ?? 'none',
  };
  if (d?.duration) patch.duration = d.duration;
  if (d?.easing) patch.easing = d.easing;
  return patch;
}

//==================================================================================
// Parse
//==================================================================================

const TIME_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:ms|s)$/i;
const COUNT_RE = /^(?:\d+\.?\d*|\.\d+|infinite)$/i;
const IDENT_RE = /^(?:--[A-Za-z0-9_-]+|-?[A-Za-z_][A-Za-z0-9_-]*)$/;
const EASING_FN_RE = /^(?:cubic-bezier|steps|linear)\(/i;
const EASING_KW = new Set([...Object.keys(CSS_EASINGS), 'step-start', 'step-end']);
const DIR_SET = new Set<string>(ANIMATION_DIRECTIONS);
const FILL_SET = new Set<string>(ANIMATION_FILLS);
const PLAY_SET = new Set<string>(ANIMATION_PLAY_STATES);

/** کلمه‌های رزروشده: نباید به‌عنوان نام keyframes پذیرفته شوند (ابهام در shorthand) */
const RESERVED = new Set<string>([
  ...EASING_KW,
  ...DIR_SET,
  ...FILL_SET,
  ...PLAY_SET,
  'infinite',
  'initial',
  'inherit',
  'unset',
  'revert',
  'revert-layer',
]);

/** برای ورودی «Custom keyframes name» */
export function isValidAnimationName(name: string): boolean {
  const n = name.trim();
  return IDENT_RE.test(n) && !n.startsWith('--') && !RESERVED.has(n.toLowerCase());
}

function parseItem(item: string): AnimationLayer | null {
  let name: string | undefined;
  let easing: string | undefined;
  let iterations: string | undefined;
  let direction: string | undefined;
  let fill: string | undefined;
  let playState: string | undefined;
  const times: string[] = [];

  for (const tok of splitTopLevel(item, ' ')) {
    const low = tok.toLowerCase();
    if (TIME_RE.test(tok)) {
      if (times.length >= 2) return null;
      times.push(tok);
    } else if (EASING_KW.has(low) || EASING_FN_RE.test(tok)) {
      if (easing) return null;
      easing = tok;
    } else if (COUNT_RE.test(tok)) {
      if (iterations) return null;
      iterations = low;
    } else if (DIR_SET.has(low)) {
      if (direction) return null;
      direction = low;
    } else if (FILL_SET.has(low)) {
      // `none` هم می‌تواند fill باشد هم name؛ مبهم است → raw
      if (low === 'none' || fill) return null;
      fill = low;
    } else if (PLAY_SET.has(low)) {
      if (playState) return null;
      playState = low;
    } else if (tok.includes('(')) {
      return null; // var() / calc() ...
    } else if (isValidAnimationName(tok)) {
      if (name) return null;
      name = tok;
    } else {
      return null;
    }
  }
  if (!name) return null;

  return createAnimation({
    name,
    duration: times[0] ?? '0s',
    delay: times[1] ?? '0s',
    easing: easing ?? 'ease',
    iterations: iterations ?? '1',
    direction: direction ?? 'normal',
    fill: fill ?? 'none',
    playState: playState ?? 'running',
  });
}

/** مقدار shorthand را می‌خواند. `none`/خالی → [] */
export function parseAnimationShorthand(text: string | null | undefined): AnimationLayer[] {
  const t = (text ?? '').trim();
  if (!t || t.toLowerCase() === 'none') return [];
  return splitTopLevel(t, ',').map((item) => parseItem(item) ?? createAnimation({ raw: item }));
}

export interface AnimationStyleLike {
  animation?: string;
  animationName?: string;
  animationDuration?: string;
  animationTimingFunction?: string;
  animationDelay?: string;
  animationIterationCount?: string;
  animationDirection?: string;
  animationFillMode?: string;
  animationPlayState?: string;
}

/** longhand ها: لیست‌ها طبق قاعده‌ی CSS به طول animation-name تکرار می‌شوند */
export function parseAnimationLonghands(s: AnimationStyleLike): AnimationLayer[] {
  const names = splitTopLevel(s.animationName ?? '', ',');
  if (!names.length || (names.length === 1 && names[0].toLowerCase() === 'none')) return [];
  const list = (v?: string) => splitTopLevel(v ?? '', ',');
  const dur = list(s.animationDuration);
  const ease = list(s.animationTimingFunction);
  const del = list(s.animationDelay);
  const iter = list(s.animationIterationCount);
  const dir = list(s.animationDirection);
  const fill = list(s.animationFillMode);
  const play = list(s.animationPlayState);
  const at = (arr: string[], i: number, fb: string) => (arr.length ? arr[i % arr.length] : fb);

  return names.map((n, i) =>
    createAnimation({
      name: n,
      duration: at(dur, i, '0s'),
      easing: at(ease, i, 'ease'),
      delay: at(del, i, '0s'),
      iterations: at(iter, i, '1'),
      direction: at(dir, i, 'normal'),
      fill: at(fill, i, 'none'),
      playState: at(play, i, 'running'),
    }),
  );
}

/** منبع واحد حقیقت: اگر shorthand هست همان، وگرنه longhand */
export function parseAnimationStyle(s: AnimationStyleLike): AnimationLayer[] {
  if (s.animation && s.animation.trim()) return parseAnimationShorthand(s.animation);
  if (s.animationName && s.animationName.trim()) return parseAnimationLonghands(s);
  return [];
}

//==================================================================================
// Serialize
//==================================================================================

const ZERO_TIME_RE = /^[+-]?0*\.?0+(?:ms|s)$/i;

export function serializeAnimationLayer(l: AnimationLayer): string {
  if (l.raw) return l.raw;
  // ترتیب: name duration easing [delay] [iterations] [direction] [fill] [play-state]  — مقدارهای پیش‌فرض نوشته نمی‌شوند
  const parts = [l.name || ANIMATION_DEFAULTS.name, l.duration || '0ms', l.easing || 'ease'];
  const delay = (l.delay ?? '').trim();
  if (delay && !ZERO_TIME_RE.test(delay)) parts.push(delay);
  const it = (l.iterations ?? '').trim();
  if (it && it !== '1') parts.push(it);
  if (l.direction && l.direction !== 'normal') parts.push(l.direction);
  if (l.fill && l.fill !== 'none') parts.push(l.fill);
  if (l.playState && l.playState !== 'running') parts.push(l.playState);
  return parts.join(' ');
}

export function serializeAnimation(layers: readonly AnimationLayer[]): string {
  return layers.map(serializeAnimationLayer).join(', ');
}
