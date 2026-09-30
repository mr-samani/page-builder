export class CSSStyleHelper {
  static cssTextToStyleObject(cssText: string): Partial<CSSStyleDeclaration> {
    const result = Object.create(null) as Record<string, string>;

    if (!cssText || !cssText.trim()) {
      return result;
    }
    const declarations = this.splitDeclarations(cssText);

    for (const declaration of declarations) {
      const colonIndex = declaration.indexOf(':');
      if (colonIndex === -1) continue;

      const property = declaration.slice(0, colonIndex).trim();
      const value = declaration.slice(colonIndex + 1).trim();

      if (!property || !value) continue;

      result[this.toStyleKey(property)] = value;
    }

    return result as Partial<CSSStyleDeclaration>;
  }

  static styleObjectToCssText(style: Partial<CSSStyleDeclaration>, minify = true): string {
    if (!style) return '';

    const parts: string[] = [];
    const obj = style as Record<string, any>;

    for (const key in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
      if (key === 'cssText') continue;

      const value = obj[key];
      if (typeof value !== 'string' || !value.trim()) continue;

      const property = key.includes('-') || key.startsWith('--') ? key : this.toKebabCase(key);

      parts.push(`${property}: ${value.trim()};`);
    }

    return minify ? parts.join(' ') : parts.join('\n');
  }

  /**
   * kebab-case → کلید شیء style. custom property ها (`--my-var`) دست‌نخورده می‌مانند
   * (قبلاً به `-MyVar` خراب می‌شدند).
   */
  private static toStyleKey(property: string): string {
    return property.startsWith('--') ? property : this.toCamelCase(property);
  }

  /** نقشه‌ی declaration ها (kebab-case، مثل خروجی ClassManagerService) → شیء style برای کنترل‌ها */
  static declsToStyleObject(decls: Record<string, string>): Partial<CSSStyleDeclaration> {
    const result = Object.create(null) as Record<string, string>;
    for (const k of Object.keys(decls)) result[this.toStyleKey(k)] = decls[k];
    return result as Partial<CSSStyleDeclaration>;
  }

  /** شیء style کنترل‌ها → نقشه‌ی kebab-case (فقط مقدارهای غیرخالی) */
  static styleObjectToDecls(style: Partial<CSSStyleDeclaration>): Record<string, string> {
    const out: Record<string, string> = {};
    if (!style) return out;
    const obj = style as Record<string, any>;
    for (const key in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, key) || key === 'cssText') continue;
      const value = obj[key];
      if (typeof value !== 'string' || !value.trim()) continue;
      out[key.startsWith('--') || key.includes('-') ? key : this.toKebabCase(key)] = value.trim();
    }
    return out;
  }

  /**
   * تبدیل property name از kebab-case به camelCase
   * مثال: background-color -> backgroundColor
   */
  private static toCamelCase(property: string): string {
    return property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * تبدیل property name از camelCase به kebab-case
   * مثال: backgroundColor -> background-color
   */
  private static toKebabCase(property: string): string {
    return property.replace(/([A-Z])/g, '-$1').toLowerCase();
  }

  private static splitDeclarations(cssText: string): string[] {
    const parts: string[] = [];
    let buffer = '';
    let quote: '"' | "'" | null = null;
    let escape = false;
    let parenDepth = 0;
    let bracketDepth = 0;

    for (let i = 0; i < cssText.length; i++) {
      const ch = cssText[i];

      if (escape) {
        buffer += ch;
        escape = false;
        continue;
      }

      if (ch === '\\') {
        buffer += ch;
        escape = true;
        continue;
      }

      if (quote) {
        buffer += ch;
        if (ch === quote) quote = null;
        continue;
      }

      if (ch === '"' || ch === "'") {
        quote = ch;
        buffer += ch;
        continue;
      }

      if (ch === '(') parenDepth++;
      else if (ch === ')' && parenDepth > 0) parenDepth--;
      else if (ch === '[') bracketDepth++;
      else if (ch === ']' && bracketDepth > 0) bracketDepth--;

      if (ch === ';' && parenDepth === 0 && bracketDepth === 0) {
        const item = buffer.trim();
        if (item) parts.push(item);
        buffer = '';
        continue;
      }

      buffer += ch;
    }

    const last = buffer.trim();
    if (last) parts.push(last);

    return parts;
  }
}
