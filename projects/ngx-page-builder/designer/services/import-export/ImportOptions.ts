export interface ImportOptions {
  /**
   * لیست attribute های مجاز برای نگه‌داری
   */
  allowedAttributes?: string[];
  /**
   * آیا استایل‌های inline را حفظ کنیم؟
   */
  preserveInlineStyles?: boolean;
  /**
   * آیا استایل‌های computed را استخراج کنیم؟
   */
  extractComputedStyles?: boolean;
  /**
   * فیلتر کردن استایل‌های خاص
   */
  styleFilter?: (propertyName: string, value: string) => boolean;
  /**
   * استفاده از CORS proxy برای دور زدن مشکل CORS
   */
  useCorsProxy?: boolean;
  /**
   * آدرس CORS proxy سفارشی
   */
  corsProxyUrl?: string;
  /**
   * زمان انتظار برای رندر شدن SPA (میلی‌ثانیه)
   */
  spaWaitTime?: number;
  /**
   * استفاده از iframe برای رندر کردن SPA
   */
  useRenderer?: boolean;
}
