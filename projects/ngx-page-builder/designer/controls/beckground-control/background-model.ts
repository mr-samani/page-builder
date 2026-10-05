/**
 * منطق خالص (بدون Angular/DOM) کنترل Background:
 * لایه‌های تصویر/گرادیان (چندلایه مثل Webflow) ↔ longhand های CSS، پارس shorthand ـی `background`،
 * ابزار زاویه‌ی گرادیان و ساخت `url()` ایمن.
 */
import { parseFunctions, splitTopLevel } from '../css-unit-field/css-value-utils';

//==================================================================================
// Types
//==================================================================================

export type BgKind = 'image' | 'gradient';

export interface BgLayer {
  /** شناسه‌ی پایدار برای track و انتخاب لایه */
  uid: number;
  kind: BgKind;
  /** `url("...")` ، `linear-gradient(...)` یا هر مقدار دیگر (var() ، image-set() ...) */
  image: string;
  /** '' = پیش‌فرض CSS */
  size: string;
  position: string;
  repeat: string;
  attachment: string;
}

export const BG_DEFAULTS = { size: 'auto', position: '0% 0%', repeat: 'repeat', attachment: 'scroll' } as const;
type AuxKey = keyof typeof BG_DEFAULTS;
export const AUX_KEYS: AuxKey[] = ['size', 'position', 'repeat', 'attachment'];

let uidCounter = 0;
export function createLayer(kind: BgKind, image: string, patch: Partial<BgLayer> = {}): BgLayer {
  return { uid: ++uidCounter, kind, image, size: '', position: '', repeat: '', attachment: '', ...patch };
}

/** لایه‌ی تصویر تازه: همان چیزی که تقریباً همه می‌خواهند (پرکردن کادر، وسط، بدون تکرار) */
export const newImageLayer = (image = '') =>
  createLayer('image', image, { size: 'cover', position: '50% 50%', repeat: 'no-repeat' });

export const newGradientLayer = (image: string) => createLayer('gradient', image);

const GRADIENT_RE = /^(?:repeating-)?(?:linear|radial|conic)-gradient\(/i;
export const classifyImage = (image: string): BgKind => (GRADIENT_RE.test(image.trim()) ? 'gradient' : 'image');

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ');

//==================================================================================
// Read: longhands + legacy `background` shorthand
//==================================================================================

export interface BgStyleLike {
  background?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
  backgroundAttachment?: string;
  backgroundColor?: string;
}

export interface BgState {
  layers: BgLayer[];
  color: string;
  /** shorthand ی `background` در style هست (ویرایش آن را به longhand تبدیل می‌کند) */
  hasShorthand: boolean;
  /** shorthand هست ولی ادیتور نمی‌تواند آن را با اطمینان بخواند */
  unreadable: boolean;
}

const cyc = (list: string[], i: number): string => (list.length ? list[i % list.length] : '');
const listOf = (v: string | undefined): string[] => splitTopLevel((v ?? '').trim(), ',');

const IMAGE_START = /^(?:url\(|image-set\(|-webkit-image-set\(|cross-fade\(|element\()|^(?:repeating-)?(?:linear|radial|conic)-gradient\(/i;
const REPEAT_KW = new Set(['repeat', 'repeat-x', 'repeat-y', 'no-repeat', 'space', 'round']);
const ATTACH_KW = new Set(['scroll', 'fixed', 'local']);
const BOX_KW = new Set(['border-box', 'padding-box', 'content-box', 'text']);
const POS_KW = new Set(['left', 'right', 'top', 'bottom', 'center']);
const LEN_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:px|%|em|rem|vw|vh|vmin|vmax|ch|ex|cm|mm|in|pt)?$/i;
const COLOR_FN = /^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i;
const NAMED_COLOR = /^(?:transparent|currentcolor|[a-z]{3,20})$/i;

function isColorToken(t: string): boolean {
  if (/^#[0-9a-f]{3,8}$/i.test(t) || COLOR_FN.test(t)) return true;
  const l = t.toLowerCase();
  if (l === 'transparent' || l === 'currentcolor') return true;
  // اسم رنگ: هر کلمه‌ی الفبایی که کلیدواژه‌ی دیگری نیست
  return (
    NAMED_COLOR.test(t) &&
    !REPEAT_KW.has(l) &&
    !ATTACH_KW.has(l) &&
    !BOX_KW.has(l) &&
    !POS_KW.has(l) &&
    !['none', 'auto', 'cover', 'contain', 'inherit', 'initial', 'unset', 'revert'].includes(l)
  );
}

const sizeish = (t: string) => t === 'auto' || t === 'cover' || t === 'contain' || LEN_RE.test(t);

function splitSlashTopLevel(text: string): [string, string | null] {
  let depth = 0;
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
    else if (ch === '/' && depth === 0) return [text.slice(0, i), text.slice(i + 1)];
  }
  return [text, null];
}

/**
 * `background: ...` را به لایه‌ها + رنگ می‌شکند. هرچه با اطمینان نخوانیم
 * (origin/clip، var() مبهم، ساختار عجیب) → null تا ادیتور چیزی را خراب نکند.
 */
export function parseBackgroundShorthand(text: string): { layers: BgLayer[]; color: string } | null {
  const t = (text ?? '').trim();
  if (!t) return { layers: [], color: '' };
  if (/^(inherit|initial|unset|revert)/i.test(t)) return null;

  const parts = splitTopLevel(t, ',');
  const layers: BgLayer[] = [];
  let color = '';

  for (let pi = 0; pi < parts.length; pi++) {
    const [left, right] = splitSlashTopLevel(parts[pi]);
    const leftTokens = splitTopLevel(left, ' ');
    const rightTokens = right === null ? [] : splitTopLevel(right, ' ');

    // اندازه: یک یا دو توکن اول بعد از «/»
    const sizeTokens: string[] = [];
    while (rightTokens.length && sizeTokens.length < 2 && sizeish(rightTokens[0].toLowerCase())) {
      sizeTokens.push(rightTokens.shift()!);
    }
    if (right !== null && sizeTokens.length === 0) return null;

    let image = '';
    let layerColor = '';
    const repeat: string[] = [];
    let attachment = '';
    const position: string[] = [];

    const classify = (tok: string, fromLeft: boolean): boolean => {
      const l = tok.toLowerCase();
      if (l === 'none') {
        image = image || 'none';
        return true;
      }
      if (IMAGE_START.test(tok)) {
        if (image && image !== 'none') return false;
        image = tok;
        return true;
      }
      if (REPEAT_KW.has(l)) {
        repeat.push(l);
        return repeat.length <= 2;
      }
      if (ATTACH_KW.has(l)) {
        attachment = l;
        return true;
      }
      if (BOX_KW.has(l)) return false; // origin / clip → پشتیبانی نمی‌شود
      if (fromLeft && (POS_KW.has(l) || LEN_RE.test(l) || /^(?:calc|min|max|clamp)\(/i.test(tok))) {
        position.push(tok);
        return true;
      }
      if (/^var\(/i.test(tok)) return false; // مبهم: رنگ یا تصویر؟
      if (isColorToken(tok)) {
        if (layerColor) return false;
        layerColor = tok;
        return true;
      }
      return false;
    };

    for (const tok of leftTokens) if (!classify(tok, true)) return null;
    for (const tok of rightTokens) if (!classify(tok, false)) return null;

    if (layerColor) {
      if (pi !== parts.length - 1) return null; // رنگ فقط در آخرین لایه مجاز است
      color = layerColor;
    }
    if (!image || image === 'none') {
      if (layerColor || image === 'none') continue; // لایه‌ی فقط-رنگ یا `none`
      return null; // فقط repeat/position بدون تصویر → مبهم
    }
    layers.push(
      createLayer(classifyImage(image), image, {
        size: sizeTokens.join(' ').toLowerCase(),
        position: position.join(' ').toLowerCase(),
        repeat: repeat.join(' '),
        attachment,
      }),
    );
  }
  return { layers, color };
}

export function readBackground(s: BgStyleLike): BgState {
  const shorthandText = (s.background ?? '').trim();
  let baseLayers: BgLayer[] = [];
  let color = '';
  let unreadable = false;

  if (shorthandText) {
    const parsed = parseBackgroundShorthand(shorthandText);
    if (parsed) {
      baseLayers = parsed.layers;
      color = parsed.color;
    } else {
      unreadable = true;
    }
  }

  // longhand ها بر shorthand غلبه دارند (در cascade معمولاً دیرتر و مشخص‌ترند)
  const imgText = (s.backgroundImage ?? '').trim();
  let layers = baseLayers;
  if (imgText) {
    const imgs = imgText.toLowerCase() === 'none' ? [] : listOf(imgText);
    layers = imgs.map((image, i) => {
      const prev = baseLayers.length ? baseLayers[i % baseLayers.length] : undefined;
      return createLayer(classifyImage(image), image, {
        size: prev?.size ?? '',
        position: prev?.position ?? '',
        repeat: prev?.repeat ?? '',
        attachment: prev?.attachment ?? '',
      });
    });
  }
  const lists: Record<AuxKey, string[]> = {
    size: listOf(s.backgroundSize),
    position: listOf(s.backgroundPosition),
    repeat: listOf(s.backgroundRepeat),
    attachment: listOf(s.backgroundAttachment),
  };
  layers.forEach((l, i) => {
    for (const k of AUX_KEYS) if (lists[k].length) l[k] = cyc(lists[k], i);
  });

  return {
    layers,
    color: (s.backgroundColor ?? '').trim() || color,
    hasShorthand: !!shorthandText,
    unreadable,
  };
}

//==================================================================================
// Write
//==================================================================================

export interface BgWrite {
  backgroundImage: string;
  backgroundSize: string;
  backgroundPosition: string;
  backgroundRepeat: string;
  backgroundAttachment: string;
}

/**
 * longhand ها را هم‌تراز با لایه‌ها می‌نویسد. هر property که همه‌ی لایه‌هایش پیش‌فرض باشد
 * حذف می‌شود ('') تا خروجی تمیز بماند؛ در غیر این‌صورت برای همه‌ی لایه‌ها صریح نوشته می‌شود
 * (چون CSS لیست‌های کوتاه‌تر را تکرار می‌کند و هم‌ترازی را به‌هم می‌زند).
 */
export function serializeLayers(layers: readonly BgLayer[]): BgWrite {
  const aux = (k: AuxKey): string => {
    const vals = layers.map((l) => l[k].trim() || BG_DEFAULTS[k]);
    return vals.every((v) => norm(v) === norm(BG_DEFAULTS[k])) ? '' : vals.join(', ');
  };
  return {
    backgroundImage: layers.map((l) => l.image.trim()).filter(Boolean).join(', '),
    backgroundSize: aux('size'),
    backgroundPosition: aux('position'),
    backgroundRepeat: aux('repeat'),
    backgroundAttachment: aux('attachment'),
  };
}

//==================================================================================
// url()
//==================================================================================

/** `url("a b.png")` / `url(a.png)` → `a b.png` ؛ اگر url نیست → null */
export function unwrapUrl(image: string): string | null {
  const m = /^url\(\s*(["']?)([\s\S]*?)\1\s*\)$/i.exec(image.trim());
  return m ? m[2] : null;
}

/** مسیر را در `url("...")` می‌گذارد و کاراکترهایی که کوتیشن را می‌شکنند encode می‌کند */
export function wrapUrl(path: string): string {
  const p = path.trim();
  if (!p) return '';
  return `url("${p.replace(/["\\\r\n]/g, (c) => encodeURIComponent(c))}")`;
}

/** نتیجه‌ی file picker → url(). data:/http(s): همان‌طور می‌ماند؛ مسیر نسبی با `baseUrlAddress` کامل می‌شود */
export function buildImageUrl(result: string, base?: string): string {
  const r = (result ?? '').trim();
  if (!r) return '';
  const absolute = /^(?:data:|https?:|\/\/)/i.test(r);
  return wrapUrl(absolute ? r : `${base ?? ''}${r}`);
}

//==================================================================================
// Gradients
//==================================================================================

export interface GradientPreset {
  label: string;
  css: string;
}

export const GRADIENT_PRESETS: GradientPreset[] = [
  { label: 'Dark overlay', css: 'linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5))' },
  { label: 'Fade to black', css: 'linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.75) 100%)' },
  { label: 'Fade to white', css: 'linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, #ffffff 100%)' },
  { label: 'Violet', css: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { label: 'Sunset', css: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { label: 'Ocean', css: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { label: 'Mint', css: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
  { label: 'Peach', css: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
  { label: 'Spotlight', css: 'radial-gradient(circle at 50% 50%, #ffffff 0%, #cfd8ff 100%)' },
  { label: 'Rainbow', css: 'conic-gradient(from 0deg, #ff6b6b, #feca57, #48dbfb, #ff6b6b)' },
];

/**
 * زاویه‌ی linear-gradient: عدد (deg)، 180 اگر جهت ننوشته (پیش‌فرض CSS)، و null اگر قابل‌ویرایش نیست
 * (`to right` ، turn/rad ، یا اصلاً linear نیست).
 */
export function gradientAngle(css: string): number | null {
  const fn = parseFunctions(css.trim());
  if (!fn || fn.length !== 1 || fn[0].name.toLowerCase() !== 'linear-gradient') return null;
  const first = (fn[0].args[0] ?? '').trim().toLowerCase();
  if (/^to\s/.test(first)) return null;
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+))deg$/.exec(first);
  if (m) return parseFloat(m[1]);
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:turn|rad|grad)$/.test(first)) return null;
  return 180; // اولین آرگومان رنگ است → جهت پیش‌فرض
}

/** زاویه را عوض می‌کند، بقیه‌ی گرادیان دست‌نخورده می‌ماند. اگر ویرایش ممکن نباشد همان ورودی را برمی‌گرداند */
export function withGradientAngle(css: string, deg: number): string {
  const cur = gradientAngle(css);
  if (cur === null) return css;
  const fn = parseFunctions(css.trim())![0];
  const rest = /^(?:[+-]?(?:\d+\.?\d*|\.\d+))deg$/i.test((fn.args[0] ?? '').trim()) ? fn.args.slice(1) : fn.args;
  const d = Math.round(deg * 100) / 100;
  return `linear-gradient(${[`${d}deg`, ...rest].join(', ')})`;
}

//==================================================================================
// Size mode
//==================================================================================

export type SizeMode = 'auto' | 'cover' | 'contain' | 'custom';

export function sizeMode(size: string): SizeMode {
  const s = norm(size);
  if (!s || s === 'auto' || s === 'auto auto') return 'auto';
  if (s === 'cover') return 'cover';
  if (s === 'contain') return 'contain';
  return 'custom';
}

/** «120px» → [120px, auto] ؛ «50% 20px» → [50%, 20px] */
export function splitSize(size: string): [string, string] {
  const t = splitTopLevel(size.trim(), ' ');
  return [t[0] ?? 'auto', t[1] ?? 'auto'];
}
export const joinSize = (w: string, h: string): string => `${w || 'auto'} ${h || 'auto'}`;

//==================================================================================
// Labels
//==================================================================================

export function layerTitle(l: BgLayer): string {
  if (l.kind === 'gradient') {
    const t = l.image.trim().toLowerCase();
    const type = t.startsWith('radial') || t.startsWith('repeating-radial') ? 'Radial' : t.includes('conic') ? 'Conic' : 'Linear';
    return `${type} gradient`;
  }
  return l.image.trim() ? 'Image' : 'Image (empty)';
}

export function layerMeta(l: BgLayer): string {
  if (l.kind === 'gradient') {
    const a = gradientAngle(l.image);
    return a === null ? 'custom' : `${a}°`;
  }
  const u = unwrapUrl(l.image);
  if (u === null) return l.image.trim().slice(0, 40) || 'No file';
  if (/^data:/i.test(u)) return 'Embedded image';
  let name = u.split(/[?#]/)[0].split('/').filter(Boolean).pop() ?? u;
  try {
    name = decodeURIComponent(name);
  } catch {
    /* keep raw */
  }
  return name.length > 34 ? name.slice(0, 31) + '…' : name || 'No file';
}
