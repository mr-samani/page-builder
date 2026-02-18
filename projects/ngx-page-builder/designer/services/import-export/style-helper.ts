import { USEFUL_STYLES } from './allowed-consts';
import { ImportOptions } from './ImportOptions';

export abstract class StyleHelper {
  /**
   * استخراج استایل‌های المنت (بهینه شده)
   * فقط استایل‌هایی که واقعاً روی این المنت تنظیم شده‌اند
   */
  public static async extractStyles(element: HTMLElement, options?: ImportOptions): Promise<string | undefined> {
    const styles: Record<string, string> = {};

    // 1. استایل‌های inline (اینها حتماً مختص خود المنت هستند)
    if (options?.preserveInlineStyles !== false && element.style.length > 0) {
      for (let i = 0; i < element.style.length; i++) {
        const propertyName = element.style[i];
        const value = element.style.getPropertyValue(propertyName);

        if (this.shouldIncludeStyle(propertyName, value, options)) {
          styles[propertyName] = value;
        }
      }
    }

    // 2. استایل‌های computed (با مقایسه با parent)
    const shouldExtractComputed = options?.useRenderer || options?.extractComputedStyles;

    if (shouldExtractComputed && typeof window !== 'undefined') {
      try {
        const computedStyles = window.getComputedStyle(element);

        // ساخت یک المنت dummy با همان تگ برای مقایسه
        const referenceElement = this.createReferenceElement(element);
        const referenceStyles = window.getComputedStyle(referenceElement);

        // گرفتن استایل‌های parent برای مقایسه
        const parentStyles = element.parentElement ? window.getComputedStyle(element.parentElement) : null;

        USEFUL_STYLES.forEach((propertyName) => {
          const value = computedStyles.getPropertyValue(propertyName);
          const referenceValue = referenceStyles.getPropertyValue(propertyName);
          const parentValue = parentStyles?.getPropertyValue(propertyName);

          // شرط 1: مقدار نباید خالی یا پیش‌فرض باشه
          if (!value || value === 'none' || value === 'initial' || value === 'normal' || value === '') {
            return;
          }

          // شرط 2: نباید از قبل در inline styles داشته باشیم
          if (styles[propertyName]) {
            return;
          }

          // شرط 3: باید با مقدار reference متفاوت باشه (یعنی واقعاً تنظیم شده)
          if (value === referenceValue) {
            return;
          }

          // شرط 4: اگر دقیقاً مثل parent هست، احتمالاً inherit شده (skip)
          // مگر اینکه inherited properties باشند
          if (parentValue && value === parentValue && !this.isInheritedProperty(propertyName)) {
            return;
          }

          // شرط 5: نباید مقدار پیش‌فرض باشه
          if (this.isDefaultValue(propertyName, value)) {
            return;
          }

          // شرط 6: باید در لیست styleFilter ما باشه
          if (this.shouldIncludeStyle(propertyName, value, options)) {
            styles[propertyName] = value;
          }
        });

        // پاکسازی reference element
        referenceElement.remove();
        (referenceElement as any).__container.remove();
      } catch (error) {
        console.warn('Error on export computed styles:', error);
      }
    }

    // تبدیل به string CSS
    if (Object.keys(styles).length > 0) {
      return Object.entries(styles)
        .map(([prop, value]) => `${prop}: ${value};`)
        .join(' ');
    }

    return undefined;
  }

  /**
   * ساخت یک المنت مرجع برای مقایسه
   * این المنت هیچ استایلی نداره و نشون میده استایل پیش‌فرض چیه
   */
  private static createReferenceElement(element: HTMLElement): HTMLElement {
    const tagName = element.tagName.toLowerCase();
    const reference = document.createElement(tagName);

    // اضافه کردن به یک container مخفی
    const container = document.createElement('div');
    container.style.cssText = `
    position: absolute;
    left: -9999px;
    top: -9999px;
    visibility: hidden;
    pointer-events: none;
  `;

    container.appendChild(reference);
    document.body.appendChild(container);

    // برگرداندن reference element
    // توجه: باید بعداً پاکش کنیم
    (reference as any).__container = container;

    return reference;
  }

  /**
   * پاکسازی reference element
   */
  private static cleanupReferenceElement(element: HTMLElement): void {
    try {
      const container = (element as any).__container;
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    } catch (error) {
      console.warn('Error cleaning reference element:', error);
    }
  }

  /**
   * بررسی اینکه آیا property به صورت طبیعی inherit می‌شه
   */
  private static isInheritedProperty(propertyName: string): boolean {
    const inheritedProperties = [
      'color',
      'font-family',
      'font-size',
      'font-weight',
      'font-style',
      'line-height',
      'text-align',
      'text-decoration',
      'text-transform',
      'letter-spacing',
      'word-spacing',
      'direction',
      'cursor',
      'visibility',
    ];

    return inheritedProperties.includes(propertyName);
  }

  /**
   * بررسی اینکه آیا مقدار، مقدار پیش‌فرض است
   */
  private static isDefaultValue(propertyName: string, value: string): boolean {
    // مقادیر پیش‌فرض معمول
    const commonDefaults = ['auto', '0px', '0', 'none', 'normal', 'initial', 'transparent'];
    if (commonDefaults.includes(value)) {
      return true;
    }

    // مقادیر پیش‌فرض خاص هر property
    const specificDefaults: Record<string, string[]> = {
      display: ['inline', 'block'], // بسته به تگ
      position: ['static'],
      color: ['rgb(0, 0, 0)', 'rgba(0, 0, 0, 1)'],
      'background-color': ['rgba(0, 0, 0, 0)', 'transparent'],
      'font-size': ['16px', '14px', '12px'],
      'font-weight': ['400', 'normal'],
      margin: ['0px'],
      'margin-top': ['0px'],
      'margin-right': ['0px'],
      'margin-bottom': ['0px'],
      'margin-left': ['0px'],
      padding: ['0px'],
      'padding-top': ['0px'],
      'padding-right': ['0px'],
      'padding-bottom': ['0px'],
      'padding-left': ['0px'],
      border: ['0px none rgb(0, 0, 0)', '0px none rgba(0, 0, 0, 0)'],
      'border-width': ['0px'],
      'border-style': ['none'],
      width: ['auto'],
      height: ['auto'],
      opacity: ['1'],
      'z-index': ['auto'],
      flex: ['0 1 auto'],
      'flex-direction': ['row'],
      'flex-wrap': ['nowrap'],
      'justify-content': ['flex-start', 'normal'],
      'align-items': ['stretch', 'normal'],
    };

    const defaults = specificDefaults[propertyName];
    if (defaults && defaults.includes(value)) {
      return true;
    }

    // بررسی border compound
    if (propertyName.startsWith('border') && value.includes('none')) {
      return true;
    }

    return false;
  }

  /**
   * بررسی اینکه آیا استایل باید شامل شود
   */
  private static shouldIncludeStyle(propertyName: string, value: string, options?: ImportOptions): boolean {
    // اگر فیلتر سفارشی داریم
    if (options?.styleFilter) {
      return options.styleFilter(propertyName, value);
    }

    // فیلتر پیش‌فرض: فقط استایل‌های مفید
    return USEFUL_STYLES.includes(propertyName);
  }

  // ========== نسخه جایگزین با روش دیگر (بدون reference element) ==========

  /**
   * استخراج استایل‌های المنت (روش دوم - سبک‌تر)
   * این روش از classList و inline styles المنت و والدش استفاده می‌کنه
   */
  private static async extractStylesAlternative(
    element: HTMLElement,
    options?: ImportOptions,
  ): Promise<string | undefined> {
    const styles: Record<string, string> = {};

    // 1. استایل‌های inline همیشه مختص خود المنت هستند
    if (options?.preserveInlineStyles !== false && element.style.length > 0) {
      for (let i = 0; i < element.style.length; i++) {
        const propertyName = element.style[i];
        const value = element.style.getPropertyValue(propertyName);

        if (this.shouldIncludeStyle(propertyName, value, options)) {
          styles[propertyName] = value;
        }
      }
    }

    // 2. استایل‌های computed با فیلتر هوشمند
    const shouldExtractComputed = options?.useRenderer || options?.extractComputedStyles;

    if (shouldExtractComputed && typeof window !== 'undefined') {
      try {
        const computedStyles = window.getComputedStyle(element);

        // گرفتن استایل‌های parent
        const parentComputed = element.parentElement ? window.getComputedStyle(element.parentElement) : null;

        USEFUL_STYLES.forEach((propertyName) => {
          const value = computedStyles.getPropertyValue(propertyName);

          // فیلتر اولیه
          if (!value || value === 'none' || value === 'initial' || value === 'normal' || value === '') {
            return;
          }

          // اگر قبلاً داریم، skip
          if (styles[propertyName]) {
            return;
          }

          // اگر مقدار پیش‌فرض است، skip
          if (this.isDefaultValue(propertyName, value)) {
            return;
          }

          // مقایسه با parent (فقط برای non-inherited properties)
          if (parentComputed && !this.isInheritedProperty(propertyName)) {
            const parentValue = parentComputed.getPropertyValue(propertyName);

            // اگر دقیقاً مثل parent است، احتمالاً inherit شده
            if (value === parentValue) {
              return;
            }
          }

          // برای inherited properties، فقط اگر inline باشه یا واقعاً متفاوت باشه
          if (this.isInheritedProperty(propertyName)) {
            // چک کنیم که آیا این استایل در inline styles هست
            const hasInlineStyle = element.style.getPropertyValue(propertyName) !== '';
            if (!hasInlineStyle && parentComputed) {
              const parentValue = parentComputed.getPropertyValue(propertyName);
              // اگر مثل parent هست، skip (چون inherit شده)
              if (value === parentValue) {
                return;
              }
            }
          }

          // چک نهایی با styleFilter
          if (this.shouldIncludeStyle(propertyName, value, options)) {
            // چک کردن که آیا این استایل از کلاس یا از جای دیگه اومده
            if (this.isStyleActuallyApplied(element, propertyName, value)) {
              styles[propertyName] = value;
            }
          }
        });
      } catch (error) {
        console.warn('Error on export computed styles:', error);
      }
    }

    // تبدیل به string CSS
    if (Object.keys(styles).length > 0) {
      return Object.entries(styles)
        .map(([prop, value]) => `${prop}: ${value};`)
        .join(' ');
    }

    return undefined;
  }

  /**
   * بررسی اینکه آیا استایل واقعاً روی این المنت اعمال شده
   * (نه اینکه صرفاً از parent inherit شده)
   */
  private static isStyleActuallyApplied(element: HTMLElement, propertyName: string, value: string): boolean {
    // اگر inline style داره، قطعاً applied هست
    if (element.style.getPropertyValue(propertyName)) {
      return true;
    }

    // اگر کلاس داره، احتمالاً از کلاس اومده
    if (element.classList.length > 0) {
      return true;
    }

    // برای inherited properties که parent هم همون مقدار رو داره، false
    if (this.isInheritedProperty(propertyName)) {
      const parent = element.parentElement;
      if (parent) {
        const parentValue = window.getComputedStyle(parent).getPropertyValue(propertyName);
        if (value === parentValue) {
          return false;
        }
      }
    }

    return true;
  }

  // ========== مقایسه و توصیه ==========

  /*
دو روش بالا رو داریم:

1. extractStyles (با reference element):
   ✅ دقیق‌تر
   ✅ استایل‌های پیش‌فرض تگ رو تشخیص میده
   ❌ کمی کندتر (ساخت المنت موقت)

2. extractStylesAlternative (بدون reference):
   ✅ سریع‌تر
   ✅ سبک‌تر
   ❌ ممکنه بعضی موارد رو از دست بده

پیشنهاد: از extractStyles استفاده کن، چون دقت بیشتری داره.
اگر performance مهمه، از extractStylesAlternative استفاده کن.
*/
}
