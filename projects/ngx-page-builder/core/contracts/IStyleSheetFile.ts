export interface IStyleSheetFile {
  name: string;
  data: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type BreakPointKey = 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
/** پیش‌فرض هم‌راستا با Bootstrap 5 */
export const DEFAULT_BREAKPOINTS: Breakpoint[] = [
  { key: 'sm', minWidth: 576 },
  { key: 'md', minWidth: 768 },
  { key: 'lg', minWidth: 992 },
  { key: 'xl', minWidth: 1200 },
  { key: 'xxl', minWidth: 1400 },
];

/**
 * حالت‌های شبه‌کلاس پشتیبانی‌شده.
 * فقط شبه‌کلاس‌های ساده (بدون آرگومان) مجازند تا خطر تزریق CSS نداشته باشیم.
 * اگر چیزی مثل `:nth-child()` لازم شد، جدا و آگاهانه اضافه کنید.
 */
export type PseudoState = 'hover' | 'focus' | 'focus-visible' | 'active' | 'visited' | 'disabled' | 'checked';

/** یک تکه‌ی استایل: مقدار پایه + حالت‌های شبه‌کلاس، به‌صورت متن خام CSS declarations (مثل: "color:red;font-size:14px;") */
export interface BlockCssChunk {
  base?: string;
  states?: Partial<Record<PseudoState, string>>;
}

/** استایل کامل یک بلاک: پایه + حالت‌ها + به‌ازای هر breakpoint یک BlockCssChunk جدا */
export interface BlockCss extends BlockCssChunk {
  /** کلید = نام breakpoint، مثل 'md' */
  breakpoints?: Record<BreakPointKey, BlockCssChunk>;
}

export interface Breakpoint {
  key: BreakPointKey;
  /** mobile-first: 0 یعنی بدون media query (پایه) */
  minWidth: number;
}
