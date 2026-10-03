/**
 * مدل transform: لیست «لایه»ها (Move / Scale / Rotate / Skew) ↔ متن CSS.
 *
 * اصل طراحی: هر مقداری که نمی‌شناسیم (matrix، perspective()، rotate3d، ...) به‌صورت
 * لایه‌ی «custom» دست‌نخورده نگه داشته می‌شود، تا ادیتور هیچ‌وقت CSS ورودی
 * (مثلاً import شده یا از Advanced) را خراب نکند.
 */
import {
  isOneValue,
  isZeroValue,
  parseCssNumber,
  parseFunctions,
  splitTopLevel,
} from '../css-unit-field/css-value-utils';

export type TransformKind = 'move' | 'scale' | 'rotate' | 'skew' | 'custom';
export type Axis = 'x' | 'y' | 'z';

export interface TransformLayer {
  /** شناسه‌ی پایدار برای track در @for و انتخاب لایه */
  uid: number;
  kind: TransformKind;
  x: string;
  y: string;
  z: string;
  /** فقط برای kind='custom': متن کامل تابع/توابع */
  raw: string;
}

type EditableKind = Exclude<TransformKind, 'custom'>;

export const LAYER_DEFAULTS: Record<EditableKind, { x: string; y: string; z: string }> = {
  move: { x: '0px', y: '0px', z: '0px' },
  scale: { x: '1', y: '1', z: '1' },
  rotate: { x: '0deg', y: '0deg', z: '0deg' },
  skew: { x: '0deg', y: '0deg', z: '0deg' },
};

export const KIND_LABEL: Record<TransformKind, string> = {
  move: 'Move',
  scale: 'Scale',
  rotate: 'Rotate',
  skew: 'Skew',
  custom: 'Custom',
};

/** محورهایی که برای هر نوع در UI نمایش داده می‌شود */
export const KIND_AXES: Record<TransformKind, Axis[]> = {
  move: ['x', 'y', 'z'],
  scale: ['x', 'y', 'z'],
  rotate: ['x', 'y', 'z'],
  skew: ['x', 'y'],
  custom: [],
};

let uidCounter = 0;
export function nextUid(): number {
  return ++uidCounter;
}

export function createLayer(
  kind: TransformKind,
  patch: Partial<Pick<TransformLayer, 'x' | 'y' | 'z' | 'raw'>> = {},
): TransformLayer {
  const d = kind === 'custom' ? { x: '', y: '', z: '' } : LAYER_DEFAULTS[kind];
  return { uid: nextUid(), kind, x: d.x, y: d.y, z: d.z, raw: '', ...patch };
}

export function isDefaultAxis(layer: TransformLayer, axis: Axis): boolean {
  if (layer.kind === 'custom') return true;
  return layer[axis] === LAYER_DEFAULTS[layer.kind][axis];
}

//==================================================================================
// parse
//==================================================================================

const AXIS_ORDER: Record<Axis, number> = { x: 0, y: 1, z: 2 };

export function parseTransform(text: string | null | undefined): TransformLayer[] {
  const t = (text ?? '').trim();
  if (!t || t.toLowerCase() === 'none') return [];

  const fns = parseFunctions(t);
  if (!fns) return [createLayer('custom', { raw: t })];

  const layers: TransformLayer[] = [];
  /** محورهایی که هر لایه تا اینجا از CSS گرفته (برای تصمیم merge) */
  const touched = new Map<number, Axis[]>();

  const add = (kind: EditableKind, vals: Partial<Record<Axis, string>>) => {
    const axes = Object.keys(vals) as Axis[];
    const last = layers[layers.length - 1];

    // توابع هم‌خانواده‌ی پشت‌سرهم را فقط وقتی یکی می‌کنیم که معنا عوض نشود:
    //  - translate/scale روی محورهای مجزا جابه‌جاپذیرند
    //  - rotate فقط وقتی به ترتیب X→Y→Z باشد (خروجی ما همیشه با همین ترتیب نوشته می‌شود)
    //  - skewX و skewY معادل skew(x,y) نیستند، پس merge نمی‌شوند
    if (last && last.kind === kind && kind !== 'skew') {
      const lt = touched.get(last.uid)!;
      const disjoint = axes.every((a) => !lt.includes(a));
      const ordered = kind !== 'rotate' || axes.every((a) => lt.every((b) => AXIS_ORDER[b] < AXIS_ORDER[a]));
      if (disjoint && ordered) {
        Object.assign(last, vals);
        lt.push(...axes);
        return;
      }
    }
    const layer = createLayer(kind, vals);
    layers.push(layer);
    touched.set(layer.uid, [...axes]);
  };
  const custom = (raw: string) => {
    layers.push(createLayer('custom', { raw }));
  };

  for (const f of fns) {
    const a = f.args;
    switch (f.name.toLowerCase()) {
      case 'translate':
        a.length >= 1 && a.length <= 2 ? add('move', { x: a[0], y: a[1] ?? '0px' }) : custom(f.raw);
        break;
      case 'translatex':
        a.length === 1 ? add('move', { x: a[0] }) : custom(f.raw);
        break;
      case 'translatey':
        a.length === 1 ? add('move', { y: a[0] }) : custom(f.raw);
        break;
      case 'translatez':
        a.length === 1 ? add('move', { z: a[0] }) : custom(f.raw);
        break;
      case 'translate3d':
        a.length === 3 ? add('move', { x: a[0], y: a[1], z: a[2] }) : custom(f.raw);
        break;

      case 'scale':
        a.length >= 1 && a.length <= 2 ? add('scale', { x: a[0], y: a[1] ?? a[0] }) : custom(f.raw);
        break;
      case 'scalex':
        a.length === 1 ? add('scale', { x: a[0] }) : custom(f.raw);
        break;
      case 'scaley':
        a.length === 1 ? add('scale', { y: a[0] }) : custom(f.raw);
        break;
      case 'scalez':
        a.length === 1 ? add('scale', { z: a[0] }) : custom(f.raw);
        break;
      case 'scale3d':
        a.length === 3 ? add('scale', { x: a[0], y: a[1], z: a[2] }) : custom(f.raw);
        break;

      case 'rotate':
      case 'rotatez':
        a.length === 1 ? add('rotate', { z: a[0] }) : custom(f.raw);
        break;
      case 'rotatex':
        a.length === 1 ? add('rotate', { x: a[0] }) : custom(f.raw);
        break;
      case 'rotatey':
        a.length === 1 ? add('rotate', { y: a[0] }) : custom(f.raw);
        break;

      case 'skew':
        a.length >= 1 && a.length <= 2 ? add('skew', { x: a[0], y: a[1] ?? '0deg' }) : custom(f.raw);
        break;
      case 'skewx':
        a.length === 1 ? add('skew', { x: a[0], y: '0deg' }) : custom(f.raw);
        break;
      case 'skewy':
        a.length === 1 ? add('skew', { x: '0deg', y: a[0] }) : custom(f.raw);
        break;

      default: // matrix, matrix3d, perspective, rotate3d, ...
        custom(f.raw);
    }
  }
  return layers;
}

//==================================================================================
// serialize
//==================================================================================

export function serializeLayer(l: TransformLayer): string {
  switch (l.kind) {
    case 'move':
      return isZeroValue(l.z) ? `translate(${l.x}, ${l.y})` : `translate3d(${l.x}, ${l.y}, ${l.z})`;

    case 'scale':
      if (!isOneValue(l.z)) return `scale3d(${l.x}, ${l.y}, ${l.z})`;
      return l.x === l.y ? `scale(${l.x})` : `scale(${l.x}, ${l.y})`;

    case 'rotate': {
      const parts = (
        [
          ['X', l.x],
          ['Y', l.y],
          ['Z', l.z],
        ] as const
      ).filter(([, v]) => !isZeroValue(v));
      if (parts.length === 0 || (parts.length === 1 && parts[0][0] === 'Z')) return `rotate(${l.z})`;
      return parts.map(([ax, v]) => `rotate${ax}(${v})`).join(' ');
    }

    case 'skew':
      if (isZeroValue(l.y)) return `skewX(${l.x})`;
      if (isZeroValue(l.x)) return `skewY(${l.y})`;
      return `skew(${l.x}, ${l.y})`;

    default:
      return l.raw;
  }
}

export function serializeTransform(layers: readonly TransformLayer[]): string {
  return layers
    .map(serializeLayer)
    .filter((s) => s.trim())
    .join(' ');
}

/** خلاصه‌ی کوتاه برای ردیف لیست، مثل «X 20px · Y -10px» (فقط مقدارهای غیرپیش‌فرض) */
export function summarizeLayer(l: TransformLayer): string {
  if (l.kind === 'custom') return l.raw;
  const parts: string[] = [];
  for (const ax of KIND_AXES[l.kind]) {
    if (!isDefaultAxis(l, ax)) parts.push(`${ax.toUpperCase()} ${l[ax]}`);
  }
  return parts.length ? parts.join(' · ') : 'default';
}

//==================================================================================
// transform-origin / perspective-origin
//==================================================================================

export interface Origin {
  x: string;
  y: string;
  /** مولفه‌ی سوم (فقط transform-origin) — اگر باشد دست‌نخورده نگه داشته می‌شود */
  z?: string;
}

export const ORIGIN_DEFAULT: Origin = { x: '50%', y: '50%' };
export const ORIGIN_STEPS = ['0%', '50%', '100%'] as const;

const KW_X: Record<string, string> = { left: '0%', center: '50%', right: '100%' };
const KW_Y: Record<string, string> = { top: '0%', center: '50%', bottom: '100%' };

export function parseOrigin(text: string | null | undefined): Origin | null {
  const toks = splitTopLevel((text ?? '').trim().toLowerCase(), ' ');
  if (toks.length === 0 || toks.length > 3) return null;

  const [a, b, c] = toks;
  let xTok: string;
  let yTok: string;

  if (toks.length === 1) {
    [xTok, yTok] = a === 'top' || a === 'bottom' ? ['center', a] : [a, 'center'];
  } else if (a === 'top' || a === 'bottom' || b === 'left' || b === 'right') {
    // «top left» یا «bottom right» → ترتیب معکوس
    [xTok, yTok] = [b, a];
  } else {
    [xTok, yTok] = [a, b];
  }

  const x = KW_X[xTok] ?? xTok;
  const y = KW_Y[yTok] ?? yTok;
  // کلمه‌ی کلیدی در محور اشتباه (مثل «top top») = نامعتبر
  if (x in KW_Y || y in KW_X || x === 'top' || x === 'bottom' || y === 'left' || y === 'right') return null;
  return c ? { x, y, z: c } : { x, y };
}

export function formatOrigin(o: Origin): string {
  const z = o.z && !isZeroValue(o.z) ? ` ${o.z}` : '';
  return `${o.x} ${o.y}${z}`;
}

/** آیا origin روی یکی از ۹ نقطه‌ی شبکه می‌نشیند؟ */
export function originCell(o: Origin): { col: number; row: number } | null {
  const steps = ORIGIN_STEPS as readonly string[];
  const col = steps.indexOf(normPercent(o.x));
  const row = steps.indexOf(normPercent(o.y));
  return col < 0 || row < 0 ? null : { col, row };
}

function normPercent(v: string): string {
  const n = parseCssNumber(v, ['%']);
  return n && n.unit === '%' ? `${n.num}%` : v;
}
