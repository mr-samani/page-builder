/**
 * Pure helpers of the data binding: `{{path}}` tokens, reading a value by path and turning a value into text.
 * No Angular dependency, so they can be used by the core services, the designer and the preview.
 */

/** matches `{{ a.b.c }}` (a new RegExp is created on every use: global regexes keep state in `lastIndex`) */
const TOKEN_PATTERN = String.raw`\{\{\s*([\w$-]+(?:\.[\w$-]+)*)\s*\}\}`;

const IMAGE_URL = /^(https?:|data:image\/|blob:|\/|\.{1,2}\/)|\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)(\?.*)?$/i;

/** `personalInfo.job.title` -> `{{personalInfo.job.title}}` (empty path -> empty string) */
export function toBindingToken(path: string | undefined | null): string {
  return path ? `{{${path}}}` : '';
}

export function hasBindingToken(text: string | undefined | null): boolean {
  return !!text && new RegExp(TOKEN_PATTERN).test(text);
}

/** paths of all tokens in a text, without duplicates */
export function collectBindingPaths(text: string | undefined | null): string[] {
  const paths = new Set<string>();
  for (const match of (text ?? '').matchAll(new RegExp(TOKEN_PATTERN, 'g'))) {
    paths.add(match[1]);
  }
  return [...paths];
}

/**
 * Replaces every `{{path}}` of the text with the value returned by `resolve`.
 * Missing values become an empty string. With `escape` the values are HTML-escaped (use it for html content).
 */
export function interpolateBindings(
  text: string,
  resolve: (path: string) => unknown,
  options: { escape?: boolean } = {},
): string {
  return text.replace(new RegExp(TOKEN_PATTERN, 'g'), (_token, path: string) => {
    const value = toDisplayText(resolve(path));
    return options.escape ? escapeHtml(value) : value;
  });
}

/**
 * Reads a value from an object / array by a dotted path (`address.city`, `items.0.name`).
 * Only own properties are read; a missing step gives `undefined`.
 */
export function getByPath(source: unknown, path: string | undefined | null): unknown {
  if (!path) return undefined;
  let current: any = source;
  for (const key of path.split('.')) {
    if (current === null || typeof current !== 'object' || !Object.hasOwn(current, key)) return undefined;
    current = current[key];
  }
  return current;
}

/** text shown for a value (objects and arrays can not be shown as text) */
export function toDisplayText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toLocaleDateString();
  if (typeof value === 'object') return '';
  return String(value);
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** `value` when it looks like an image address, otherwise an empty string */
export function toImageSrc(value: unknown): string {
  const text = toDisplayText(value).trim();
  return IMAGE_URL.test(text) ? text : '';
}
