/**
 * JSON.stringify with sorted object keys → identical text for identical data, whatever the key order.
 * Used for cache keys. `undefined` values and functions are dropped (like JSON.stringify), Dates become ISO strings.
 */
export function stableStringify(value: unknown): string {
  return stringify(value, 0) ?? 'null';
}

const MAX_DEPTH = 32;

function stringify(value: unknown, depth: number): string | undefined {
  if (depth > MAX_DEPTH) throw new RangeError('stableStringify: value is too deep or circular');
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'number':
      return Number.isFinite(value) ? JSON.stringify(value) : 'null';
    case 'boolean':
      return value ? 'true' : 'false';
    case 'bigint':
      return JSON.stringify(value.toString());
    case 'undefined':
    case 'function':
    case 'symbol':
      return undefined;
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'null' : JSON.stringify(value.toISOString());
  if (Array.isArray(value)) {
    let out = '[';
    for (let i = 0; i < value.length; i++) {
      if (i) out += ',';
      out += stringify(value[i], depth + 1) ?? 'null';
    }
    return out + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  let out = '{';
  let first = true;
  for (const k of keys) {
    const s = stringify(obj[k], depth + 1);
    if (s === undefined) continue;
    if (!first) out += ',';
    first = false;
    out += JSON.stringify(k) + ':' + s;
  }
  return out + '}';
}
