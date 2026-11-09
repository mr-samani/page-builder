/**
 * position-model.ts
 *
 * مدل کنترل «Position»: position + offset های top/right/bottom/left + z-index.
 *
 * - parse: `inset` (۱ تا ۴ مقداری) و longhand ها هر دو خوانده می‌شوند (longhand برنده است).
 * - serialize: همیشه longhand ها (`top` ... `left`)؛ `inset` با `''` پاک می‌شود تا دو منبع حقیقت نداشته باشیم.
 */
import { expand4 } from '../border-control/border-model';

export const POSITION_KINDS = ['static', 'relative', 'absolute', 'fixed', 'sticky'] as const;
export type PositionKind = (typeof POSITION_KINDS)[number];

export type InsetKey = 'top' | 'right' | 'bottom' | 'left';
export const INSET_KEYS: readonly InsetKey[] = ['top', 'right', 'bottom', 'left'];

export interface PositionModel {
  /** '' = ست‌نشده */
  position: string;
  top: string;
  right: string;
  bottom: string;
  left: string;
  zIndex: string;
}

export const createPositionModel = (): PositionModel => ({
  position: '',
  top: '',
  right: '',
  bottom: '',
  left: '',
  zIndex: '',
});

export const clonePositionModel = (m: PositionModel): PositionModel => ({ ...m });

export const hasPosition = (m: PositionModel): boolean =>
  !!(m.position || m.top || m.right || m.bottom || m.left || m.zIndex);

export function parsePositionModel(d: Record<string, string>): PositionModel {
  const m = createPositionModel();
  m.position = (d['position'] ?? '').trim().toLowerCase();

  const sh = expand4(d['inset']);
  if (sh) INSET_KEYS.forEach((k, i) => (m[k] = sh[i]));
  for (const k of INSET_KEYS) {
    const v = d[k]?.trim();
    if (v) m[k] = v;
  }

  m.zIndex = (d['z-index'] ?? '').trim();
  return m;
}

/** decls خروجی (kebab-case). `''` یعنی property حذف شود. */
export function serializePositionModel(m: PositionModel): Record<string, string> {
  return {
    position: m.position,
    inset: '',
    top: m.top,
    right: m.right,
    bottom: m.bottom,
    left: m.left,
    'z-index': m.zIndex,
  };
}

export function declsToCssText(d: Record<string, string>): string {
  return Object.entries(d)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}

//---------------------------------- anchors ----------------------------------

export interface AnchorPreset {
  id: string;
  label: string;
  title: string;
  /** ضلع‌های نیامده «آزاد» می‌شوند */
  set: Partial<Record<InsetKey, string>>;
}

export const ANCHORS: AnchorPreset[] = [
  { id: 'tl', label: 'Top left', title: 'Pin to the top-left corner', set: { top: '0px', left: '0px' } },
  { id: 'tr', label: 'Top right', title: 'Pin to the top-right corner', set: { top: '0px', right: '0px' } },
  { id: 'bl', label: 'Bottom left', title: 'Pin to the bottom-left corner', set: { bottom: '0px', left: '0px' } },
  { id: 'br', label: 'Bottom right', title: 'Pin to the bottom-right corner', set: { bottom: '0px', right: '0px' } },
  {
    id: 'fill',
    label: 'Fill',
    title: 'Cover the whole container (all offsets 0)',
    set: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
  },
  {
    id: 'sx',
    label: 'Stretch X',
    title: 'Stretch horizontally (left and right 0)',
    set: { left: '0px', right: '0px' },
  },
  { id: 'sy', label: 'Stretch Y', title: 'Stretch vertically (top and bottom 0)', set: { top: '0px', bottom: '0px' } },
];

export const Z_QUICK = ['-1', '0', '1', '10', '100', '999'] as const;

/** راهنمای کوتاه برای هر نوع position */
export const POSITION_HINTS: Record<PositionKind, string> = {
  static: 'Normal flow. Offsets have no effect.',
  relative:
    'Stays in the flow; offsets shift it from where it would be. It also becomes the anchor for absolute children.',
  absolute: 'Leaves the flow and is placed against the nearest positioned ancestor (set Relative on the parent).',
  fixed: 'Leaves the flow and is placed against the viewport, so it stays in place on scroll.',
  sticky: 'Scrolls normally until it reaches its offset (e.g. Top 0), then sticks. Needs at least one offset.',
};
