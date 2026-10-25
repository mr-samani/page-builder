/**
 * کتابخانه‌ی @keyframes های آماده‌ی صفحه‌ساز.
 *
 * - نام همه‌ی keyframes ها با `pb-` شروع می‌شود تا با CSS کاربر تداخل نکند.
 * - کنترل Animation فقط نام را داخل `animation` می‌نویسد؛ متن @keyframes را همین فایل می‌سازد
 *   (در CSSOM ی کَنوَس و در خروجی‌ی compileBlocksCss) تا خروجی‌ی نهایی خودکفا باشد.
 * - نام‌هایی که در این لیست نیستند (keyframes ی خود کاربر) دست‌نخورده می‌مانند.
 */

export interface AnimationPresetDefaults {
  duration?: string;
  easing?: string;
  iterations?: string;
  direction?: string;
  fill?: string;
}

export interface AnimationPreset {
  /** شناسه‌ی کوتاه (بدون پیشوند) */
  id: string;
  /** نام @keyframes در CSS */
  name: string;
  label: string;
  group: string;
  /** [offset 0..1, 'prop:value;prop:value'] */
  frames: ReadonlyArray<readonly [number, string]>;
  /** مقدارهای پیشنهادی هنگام انتخاب این پریست (فقط کلیدهای تعریف‌شده اعمال می‌شوند) */
  defaults?: AnimationPresetDefaults;
}

const IN: AnimationPresetDefaults = { fill: 'both' };
const LOOP: AnimationPresetDefaults = { iterations: 'infinite' };

const mk = (
  group: string,
  id: string,
  label: string,
  frames: ReadonlyArray<readonly [number, string]>,
  defaults?: AnimationPresetDefaults,
): AnimationPreset => ({ id, name: `pb-${id}`, label, group, frames, defaults });

export const ANIMATION_PRESETS: readonly AnimationPreset[] = [
  // ---------- Fade ----------
  mk('Fade', 'fade-in', 'Fade in', [[0, 'opacity:0'], [1, 'opacity:1']], IN),
  mk('Fade', 'fade-out', 'Fade out', [[0, 'opacity:1'], [1, 'opacity:0']], IN),
  mk('Fade', 'fade-in-up', 'Fade in up', [[0, 'opacity:0;transform:translateY(24px)'], [1, 'opacity:1;transform:translateY(0)']], IN),
  mk('Fade', 'fade-in-down', 'Fade in down', [[0, 'opacity:0;transform:translateY(-24px)'], [1, 'opacity:1;transform:translateY(0)']], IN),
  mk('Fade', 'fade-in-left', 'Fade in left', [[0, 'opacity:0;transform:translateX(-24px)'], [1, 'opacity:1;transform:translateX(0)']], IN),
  mk('Fade', 'fade-in-right', 'Fade in right', [[0, 'opacity:0;transform:translateX(24px)'], [1, 'opacity:1;transform:translateX(0)']], IN),

  // ---------- Slide ----------
  mk('Slide', 'slide-in-up', 'Slide in up', [[0, 'transform:translateY(100%)'], [1, 'transform:translateY(0)']], IN),
  mk('Slide', 'slide-in-down', 'Slide in down', [[0, 'transform:translateY(-100%)'], [1, 'transform:translateY(0)']], IN),
  mk('Slide', 'slide-in-left', 'Slide in left', [[0, 'transform:translateX(-100%)'], [1, 'transform:translateX(0)']], IN),
  mk('Slide', 'slide-in-right', 'Slide in right', [[0, 'transform:translateX(100%)'], [1, 'transform:translateX(0)']], IN),

  // ---------- Zoom ----------
  mk('Zoom', 'zoom-in', 'Zoom in', [[0, 'opacity:0;transform:scale(0.6)'], [1, 'opacity:1;transform:scale(1)']], IN),
  mk('Zoom', 'zoom-out', 'Zoom out', [[0, 'opacity:0;transform:scale(1.4)'], [1, 'opacity:1;transform:scale(1)']], IN),
  mk(
    'Zoom',
    'bounce-in',
    'Bounce in',
    [
      [0, 'opacity:0;transform:scale(0.3)'],
      [0.2, 'transform:scale(1.1)'],
      [0.4, 'transform:scale(0.9)'],
      [0.6, 'opacity:1;transform:scale(1.03)'],
      [0.8, 'transform:scale(0.97)'],
      [1, 'opacity:1;transform:scale(1)'],
    ],
    { ...IN, duration: '750ms' },
  ),

  // ---------- Flip ----------
  mk(
    'Flip',
    'flip-in-x',
    'Flip in X',
    [
      [0, 'opacity:0;transform:perspective(400px) rotateX(90deg)'],
      [0.4, 'transform:perspective(400px) rotateX(-20deg)'],
      [0.6, 'opacity:1;transform:perspective(400px) rotateX(10deg)'],
      [0.8, 'transform:perspective(400px) rotateX(-5deg)'],
      [1, 'opacity:1;transform:perspective(400px) rotateX(0)'],
    ],
    { ...IN, duration: '750ms' },
  ),
  mk(
    'Flip',
    'flip-in-y',
    'Flip in Y',
    [
      [0, 'opacity:0;transform:perspective(400px) rotateY(90deg)'],
      [0.4, 'transform:perspective(400px) rotateY(-20deg)'],
      [0.6, 'opacity:1;transform:perspective(400px) rotateY(10deg)'],
      [0.8, 'transform:perspective(400px) rotateY(-5deg)'],
      [1, 'opacity:1;transform:perspective(400px) rotateY(0)'],
    ],
    { ...IN, duration: '750ms' },
  ),
  mk('Flip', 'rotate-in', 'Rotate in', [[0, 'opacity:0;transform:rotate(-200deg)'], [1, 'opacity:1;transform:rotate(0)']], IN),

  // ---------- Attention ----------
  mk('Attention', 'pulse', 'Pulse', [[0, 'transform:scale(1)'], [0.5, 'transform:scale(1.06)'], [1, 'transform:scale(1)']]),
  mk(
    'Attention',
    'bounce',
    'Bounce',
    [
      [0, 'transform:translateY(0)'],
      [0.2, 'transform:translateY(0)'],
      [0.4, 'transform:translateY(-30px)'],
      [0.43, 'transform:translateY(-30px)'],
      [0.53, 'transform:translateY(0)'],
      [0.7, 'transform:translateY(-15px)'],
      [0.8, 'transform:translateY(0)'],
      [0.9, 'transform:translateY(-4px)'],
      [1, 'transform:translateY(0)'],
    ],
    { duration: '1s' },
  ),
  mk(
    'Attention',
    'shake',
    'Shake',
    [
      [0, 'transform:translateX(0)'],
      [0.1, 'transform:translateX(-10px)'],
      [0.2, 'transform:translateX(10px)'],
      [0.3, 'transform:translateX(-10px)'],
      [0.4, 'transform:translateX(10px)'],
      [0.5, 'transform:translateX(-10px)'],
      [0.6, 'transform:translateX(10px)'],
      [0.7, 'transform:translateX(-10px)'],
      [0.8, 'transform:translateX(10px)'],
      [0.9, 'transform:translateX(-10px)'],
      [1, 'transform:translateX(0)'],
    ],
    { duration: '800ms', easing: 'linear' },
  ),
  mk(
    'Attention',
    'swing',
    'Swing',
    [
      [0, 'transform:rotate(0)'],
      [0.2, 'transform:rotate(15deg)'],
      [0.4, 'transform:rotate(-10deg)'],
      [0.6, 'transform:rotate(5deg)'],
      [0.8, 'transform:rotate(-5deg)'],
      [1, 'transform:rotate(0)'],
    ],
    { duration: '1s' },
  ),
  mk(
    'Attention',
    'rubber-band',
    'Rubber band',
    [
      [0, 'transform:scale3d(1,1,1)'],
      [0.3, 'transform:scale3d(1.25,0.75,1)'],
      [0.4, 'transform:scale3d(0.75,1.25,1)'],
      [0.5, 'transform:scale3d(1.15,0.85,1)'],
      [0.65, 'transform:scale3d(0.95,1.05,1)'],
      [0.75, 'transform:scale3d(1.05,0.95,1)'],
      [1, 'transform:scale3d(1,1,1)'],
    ],
    { duration: '1s' },
  ),
  mk(
    'Attention',
    'heartbeat',
    'Heartbeat',
    [
      [0, 'transform:scale(1)'],
      [0.14, 'transform:scale(1.3)'],
      [0.28, 'transform:scale(1)'],
      [0.42, 'transform:scale(1.3)'],
      [0.7, 'transform:scale(1)'],
      [1, 'transform:scale(1)'],
    ],
    { duration: '1.3s' },
  ),
  mk('Attention', 'flash', 'Flash', [[0, 'opacity:1'], [0.25, 'opacity:0'], [0.5, 'opacity:1'], [0.75, 'opacity:0'], [1, 'opacity:1']], {
    duration: '1s',
    easing: 'linear',
  }),

  // ---------- Loop ----------
  mk('Loop', 'spin', 'Spin', [[0, 'transform:rotate(0deg)'], [1, 'transform:rotate(360deg)']], { ...LOOP, duration: '1s', easing: 'linear' }),
  mk('Loop', 'float', 'Float', [[0, 'transform:translateY(0)'], [0.5, 'transform:translateY(-10px)'], [1, 'transform:translateY(0)']], {
    ...LOOP,
    duration: '3s',
    easing: 'ease-in-out',
  }),
  mk('Loop', 'ping', 'Ping', [[0, 'transform:scale(1);opacity:1'], [0.75, 'transform:scale(2);opacity:0'], [1, 'transform:scale(2);opacity:0']], {
    ...LOOP,
    duration: '1s',
    easing: 'cubic-bezier(0, 0, 0.2, 1)',
  }),
  mk('Loop', 'blink', 'Blink', [[0, 'opacity:1'], [0.5, 'opacity:0.2'], [1, 'opacity:1']], { ...LOOP, duration: '1.2s', easing: 'ease-in-out' }),
];

export const ANIMATION_PRESET_GROUPS: string[] = Array.from(new Set(ANIMATION_PRESETS.map((p) => p.group)));

const BY_NAME = new Map(ANIMATION_PRESETS.map((p) => [p.name, p]));

export function findAnimationPreset(name: string | null | undefined): AnimationPreset | undefined {
  return name ? BY_NAME.get(name.trim()) : undefined;
}

const pct = (n: number) => `${+(n * 100).toFixed(2)}%`;

/** متن کامل `@keyframes pb-xxx{...}` */
export function keyframesRuleText(p: AnimationPreset): string {
  return `@keyframes ${p.name}{${p.frames.map(([o, d]) => `${pct(o)}{${d}}`).join('')}}`;
}

const ANIM_DECL_RE = /(?:^|[;{\s])animation(?:-name)?\s*:\s*([^;}]*)/gi;
const NAME_RE = /(?:^|[\s,])(pb-[a-z0-9-]+)(?=$|[\s,;])/gi;

/** نام پریست‌هایی که داخل declaration های `animation` / `animation-name` متن CSS استفاده شده‌اند */
export function usedAnimationPresets(cssText: string | null | undefined): AnimationPreset[] {
  if (!cssText || !/animation/i.test(cssText)) return [];
  const found = new Map<string, AnimationPreset>();
  for (const decl of cssText.matchAll(ANIM_DECL_RE)) {
    for (const m of decl[1].matchAll(NAME_RE)) {
      const p = BY_NAME.get(m[1].toLowerCase());
      if (p) found.set(p.name, p);
    }
  }
  return [...found.values()];
}

/** @keyframes های لازم برای متن CSS داده‌شده (هر نام فقط یک‌بار) */
export function keyframesCssFor(cssText: string | null | undefined): string {
  return usedAnimationPresets(cssText).map(keyframesRuleText).join('');
}

/** `opacity:0;transform:scale(1)` → `{ opacity: '0', transform: 'scale(1)' }` (برای Web Animations API) */
export function framesToKeyframeObjects(p: AnimationPreset, easing?: string): Keyframe[] {
  return p.frames.map(([offset, decl]) => {
    const kf: Record<string, string | number> = { offset };
    for (const part of decl.split(';')) {
      const i = part.indexOf(':');
      if (i < 0) continue;
      const prop = part.slice(0, i).trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      kf[prop] = part.slice(i + 1).trim();
    }
    // در CSS، timing-function بین هر دو keyframe اعمال می‌شود (نه روی کل چرخه) — همین رفتار را شبیه‌سازی می‌کنیم
    if (easing) kf['easing'] = easing;
    return kf as Keyframe;
  });
}
