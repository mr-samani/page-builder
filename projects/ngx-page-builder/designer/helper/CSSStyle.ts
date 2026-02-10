/**
 * CSSStyleHelper - تبدیل CSS string به CSSStyleDeclaration و بالعکس
 *
 * استفاده:
 * const helper = new CSSStyleHelper('color: red; background: blue;');
 * const style = helper.toStyleObject(); // Partial<CSSStyleDeclaration>
 * const cssText = helper.toCSSText(); // 'color: red; background: blue;'
 */
export class CSSStyleHelper {
  private styleMap = new Map<string, string>();

  constructor(cssString?: string, style?: Partial<CSSStyleDeclaration>) {
    if (cssString) {
      this.parse(cssString);
    }
    if (style) {
      const values = Object.entries(style).filter((x: any) => x[0] && x[1]);
      this.styleMap = new Map<string, string>(values as any);
    }
  }

  /**
   * Parse CSS string و ذخیره property ها
   */
  parse(cssString: string): this {
    this.styleMap.clear();

    if (!cssString || !cssString.trim()) {
      return this;
    }

    // حذف فضاهای اضافی و ; آخر
    cssString = cssString.trim().replace(/;$/, '');

    // Split by semicolon
    const declarations = cssString
      .split(';')
      .map((d) => d.trim())
      .filter((d) => d);

    declarations.forEach((declaration) => {
      const colonIndex = declaration.indexOf(':');
      if (colonIndex === -1) return;

      const property = declaration.substring(0, colonIndex).trim();
      const value = declaration.substring(colonIndex + 1).trim();

      if (property && value) {
        this.styleMap.set(property, value);
      }
    });

    return this;
  }

  /**
   * تبدیل property name از kebab-case به camelCase
   * مثال: background-color -> backgroundColor
   */
  private toCamelCase(property: string): string {
    return property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * تبدیل property name از camelCase به kebab-case
   * مثال: backgroundColor -> background-color
   */
  private toKebabCase(property: string): string {
    return property.replace(/([A-Z])/g, '-$1').toLowerCase();
  }

  /**
   * تبدیل به Partial<CSSStyleDeclaration>
   * property ها به camelCase تبدیل میشن
   */
  toStyleObject(): Partial<CSSStyleDeclaration> {
    const styleObject: any = {};

    this.styleMap.forEach((value, property) => {
      const camelProperty = this.toCamelCase(property);
      styleObject[camelProperty] = value;
    });

    // اضافه کردن cssText به object
    Object.defineProperty(styleObject, 'cssText', {
      get: () => this.toCSSText(),
      enumerable: false,
      configurable: true,
    });

    return styleObject as Partial<CSSStyleDeclaration>;
  }

  /**
   * تبدیل به CSS string (cssText)
   */
  toCSSText(): string {
    const declarations: string[] = [];

    this.styleMap.forEach((value, property) => {
      declarations.push(`${property}: ${value}`);
    });

    return declarations.join('; ') + (declarations.length > 0 ? ';' : '');
  }

  /**
   * تبدیل به CSS string بدون semicolon آخر
   */
  toCSSTextWithoutTrailingSemicolon(): string {
    const declarations: string[] = [];

    this.styleMap.forEach((value, property) => {
      declarations.push(`${property}: ${value}`);
    });

    return declarations.join('; ');
  }

  /**
   * اضافه کردن یک property
   */
  setProperty(property: string, value: string): this {
    // اگر property به صورت camelCase باشه، تبدیل به kebab-case میکنیم
    const kebabProperty = property.includes('-') ? property : this.toKebabCase(property);
    this.styleMap.set(kebabProperty, value);
    return this;
  }

  /**
   * گرفتن value یک property
   */
  getProperty(property: string): string | undefined {
    // هم camelCase و هم kebab-case رو چک میکنیم
    const kebabProperty = property.includes('-') ? property : this.toKebabCase(property);
    return this.styleMap.get(kebabProperty);
  }

  /**
   * حذف یک property
   */
  removeProperty(property: string): this {
    const kebabProperty = property.includes('-') ? property : this.toKebabCase(property);
    this.styleMap.delete(kebabProperty);
    return this;
  }

  /**
   * پاک کردن همه property ها
   */
  clear(): this {
    this.styleMap.clear();
    return this;
  }

  /**
   * چک کردن اینکه property وجود داره یا نه
   */
  hasProperty(property: string): boolean {
    const kebabProperty = property.includes('-') ? property : this.toKebabCase(property);
    return this.styleMap.has(kebabProperty);
  }

  /**
   * گرفتن تعداد property ها
   */
  get length(): number {
    return this.styleMap.size;
  }

  /**
   * گرفتن لیست همه property ها
   */
  getProperties(): string[] {
    return Array.from(this.styleMap.keys());
  }

  /**
   * Merge کردن با CSS string دیگه
   */
  merge(cssString: string): this {
    const temp = new CSSStyleHelper(cssString);
    temp.styleMap.forEach((value, property) => {
      this.styleMap.set(property, value);
    });
    return this;
  }

  /**
   * Merge کردن با style object دیگه
   */
  mergeObject(styleObject: Partial<CSSStyleDeclaration>): this {
    Object.keys(styleObject).forEach((property) => {
      if (property === 'cssText' || typeof (styleObject as any)[property] !== 'string') {
        return;
      }
      const kebabProperty = this.toKebabCase(property);
      const value = (styleObject as any)[property];
      if (value) {
        this.styleMap.set(kebabProperty, value);
      }
    });
    return this;
  }

  /**
   * Clone کردن helper
   */
  clone(): CSSStyleHelper {
    const newHelper = new CSSStyleHelper();
    this.styleMap.forEach((value, property) => {
      newHelper.styleMap.set(property, value);
    });
    return newHelper;
  }

  /**
   * تبدیل به JSON
   */
  toJSON(): Record<string, string> {
    const obj: Record<string, string> = {};
    this.styleMap.forEach((value, property) => {
      obj[property] = value;
    });
    return obj;
  }

  /**
   * ساخت از JSON
   */
  static fromJSON(json: Record<string, string>): CSSStyleHelper {
    const helper = new CSSStyleHelper();
    Object.entries(json).forEach(([property, value]) => {
      helper.setProperty(property, value);
    });
    return helper;
  }

  /**
   * تبدیل به pretty formatted CSS (با newline و indent)
   */
  toPrettyCSS(indent: string = '  '): string {
    const declarations: string[] = [];
    this.styleMap.forEach((value, property) => {
      declarations.push(`${indent}${property}: ${value};`);
    });
    return declarations.join('\n');
  }

  /**
   * اعتبارسنجی CSS
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    this.styleMap.forEach((value, property) => {
      // چک کردن property name
      if (!/^[a-z-]+$/.test(property)) {
        errors.push(`Invalid property name: ${property}`);
      }

      // چک کردن value (نباید خالی باشه)
      if (!value.trim()) {
        errors.push(`Empty value for property: ${property}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * اعمال style به یک element
   */
  applyTo(element: HTMLElement): void {
    this.styleMap.forEach((value, property) => {
      const camelProperty = this.toCamelCase(property);
      (element.style as any)[camelProperty] = value;
    });
  }

  /**
   * خواندن style از یک element
   */
  static fromElement(element: HTMLElement): CSSStyleHelper {
    return new CSSStyleHelper(element.style.cssText);
  }

  /**
   * فیلتر کردن property ها
   */
  filter(predicate: (property: string, value: string) => boolean): CSSStyleHelper {
    const newHelper = new CSSStyleHelper();
    this.styleMap.forEach((value, property) => {
      if (predicate(property, value)) {
        newHelper.styleMap.set(property, value);
      }
    });
    return newHelper;
  }

  /**
   * تبدیل به string (toString override)
   */
  toString(): string {
    return this.toCSSText();
  }

  /**
   * Iterator برای استفاده در for...of
   */
  *[Symbol.iterator](): Iterator<[string, string]> {
    for (const [property, value] of this.styleMap) {
      yield [property, value];
    }
  }
}
