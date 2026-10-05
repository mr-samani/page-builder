/** منطق خالص کنترل Size: aspect-ratio و اعتبارسنجی */

export interface RatioPreset {
  value: string;
  label: string;
}

export const RATIO_PRESETS: RatioPreset[] = [
  { value: '1 / 1', label: '1:1' },
  { value: '4 / 3', label: '4:3' },
  { value: '3 / 2', label: '3:2' },
  { value: '16 / 9', label: '16:9' },
  { value: '21 / 9', label: '21:9' },
  { value: '9 / 16', label: '9:16' },
  { value: 'auto', label: 'Auto' },
];

/** فاصله‌های دور `/` و تکراری را یکدست می‌کند: «16/9» ≡ «16 / 9» */
export function normalizeRatio(v: string | undefined | null): string {
  return (v ?? '').trim().toLowerCase().replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ');
}

const NUM = String.raw`(?:\d+\.?\d*|\.\d+)`;
const RATIO_RE = new RegExp(String.raw`^(?:auto\s+)?${NUM}(?:\s*/\s*${NUM})?$|^auto$`, 'i');

/** `16 / 9` ، `1.5` ، `auto 4 / 3` ، `auto`. (var() / calc() هم عبور داده می‌شود) */
export function isValidRatio(v: string): boolean {
  const t = v.trim();
  if (!t) return false;
  if (/^(?:var|calc)\(/i.test(t)) return true;
  if (!RATIO_RE.test(t)) return false;
  const nums = t.match(new RegExp(NUM, 'g')) ?? [];
  return nums.every((n) => parseFloat(n) > 0);
}

export const FIT_VALUES = ['fill', 'contain', 'cover', 'none', 'scale-down'] as const;
