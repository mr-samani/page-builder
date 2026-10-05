import { IPosValue } from './IPosValue';

export abstract class SpacingFormatter {
  private static unit: string = 'px'; // واحد پیش‌فرض

  private static formatValue(value: string | number | 'auto' | undefined | null): string {
    // مدیریت مقادیر نامعتبر یا undefined
    if (value === undefined || value === null) {
      return '0';
    }
    if (value === 'auto') {
      return 'auto';
    }
    // اگر عدد باشه، واحد اضافه کن
    if (typeof value === 'number' || !isNaN(Number(value))) {
      return `${Number(value)}${this.unit}`;
    }
    // اگر رشته شامل واحد باشه (مثل "10rem")، همونو برگردون
    return String(value);
  }

  static formatSpacingToCSS(spacing: IPosValue): string {
    // اگر spacing وجود نداشته باشه یا کامل نباشه
    if (!spacing) {
      return '0';
    }

    const { top, right, bottom, left } = spacing;

    // تبدیل مقادیر به فرمت معتبر
    const formattedTop = this.formatValue(top);
    const formattedRight = this.formatValue(right);
    const formattedBottom = this.formatValue(bottom);
    const formattedLeft = this.formatValue(left);

    // بررسی تساوی مقادیر برای shorthand
    if (formattedTop === formattedRight && formattedRight === formattedBottom && formattedBottom === formattedLeft) {
      // همه مقادیر برابرن (مثل margin: 10px)
      return formattedTop;
    } else if (formattedTop === formattedBottom && formattedRight === formattedLeft) {
      // دو مقدار (مثل margin: 10px 20px)
      return `${formattedTop} ${formattedRight}`;
    } else if (formattedRight === formattedLeft) {
      // سه مقدار (مثل margin: 10px 20px 30px)
      return `${formattedTop} ${formattedRight} ${formattedBottom}`;
    }
    // چهار مقدار (مثل margin: 10px 20px 30px 40px)
    return `${formattedTop} ${formattedRight} ${formattedBottom} ${formattedLeft}`;
  }

  // امکان تنظیم واحد به‌صورت دینامیک
  static setUnit(newUnit: string): void {
    if (newUnit && ['px', 'rem', 'em', '%', 'vw', 'vh'].includes(newUnit)) {
      this.unit = newUnit;
    } else {
      console.warn(`Invalid unit: ${newUnit}. Falling back to 'px'.`);
      this.unit = 'px';
    }
  }
}
