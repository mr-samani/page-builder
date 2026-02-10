/**
 * Merges two CSS inline style strings.
 * Example:
 *   mergeCssStyles("color: red; width: 20px;", "width: 30px; height: 40px;")
 * -> "color: red; width: 30px; height: 40px;"
 */
export function mergeCssStyles(styleA?: string, styleB?: string): string {
  if (!styleA && !styleB) return '';
  styleA = styleA || '';
  styleB = styleB || '';

  const objA = parseStyleString(styleA);
  const objB = parseStyleString(styleB);

  // Merge: B overrides A
  const merged = { ...objA, ...objB };

  return objectToStyleString(merged);
}

export function parseStyleString(style: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!style) return result;

  style
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .forEach((part) => {
      const [prop, ...rest] = part.split(':');
      if (!prop) return;

      const key = prop.trim().toLowerCase();
      const value = rest.join(':').trim();

      if (value) {
        result[key] = value;
      }
    });

  return result;
}

function objectToStyleString(obj: Record<string, string>): string {
  return Object.entries(obj)
    .map(([prop, val]) => `${prop}: ${val};`)
    .join(' ');
}
