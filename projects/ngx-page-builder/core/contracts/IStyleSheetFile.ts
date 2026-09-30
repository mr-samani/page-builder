export interface IStyleSheetFile {
  name: string;
  data: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type BreakPointKey = 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

/** پیش‌فرض هم‌راستا با Bootstrap 5 */
export const DEFAULT_FIRST_BREAKPOINT: Breakpoint = { key: 'xxl', minWidth: 1400, icon: 'desktop-wide' };
export const DEFAULT_BREAKPOINTS: Breakpoint[] = [
  { key: 'sm', minWidth: 576, icon: 'mobile' },
  { key: 'md', minWidth: 768, icon: 'mobile-landscape' },
  { key: 'lg', minWidth: 992, icon: 'tablet' },
  { key: 'xl', minWidth: 1200, icon: 'desktop' },
  { key: 'xxl', minWidth: 1400, icon: 'desktop-wide' },
];

/**
 * حالت‌های شبه‌کلاس پشتیبانی‌شده.
 * فقط شبه‌کلاس‌های ساده (بدون آرگومان) مجازند تا خطر تزریق CSS نداشته باشیم.
 * اگر چیزی مثل `:nth-child()` لازم شد، جدا و آگاهانه اضافه کنید.
 */
export type PseudoState = 'hover' | 'focus' | 'focus-visible' | 'active' | 'visited' | 'disabled' | 'checked' | 'none';

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
  icon: string;
  /** mobile-first: 0 یعنی بدون media query (پایه) */
  minWidth: number;
}
