/**
 * Safe property access for `a.b[0].c` / `a.0.b` paths. Parsed paths are cached (templates call the same paths for every row).
 * Prototype-polluting segments are rejected and only OWN properties are read.
 */
const cache = new Map<string, readonly string[] | null>();
const BLOCKED = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_CACHE = 2000;

export function parsePath(path: string): readonly string[] | null {
  const hit = cache.get(path);
  if (hit !== undefined) return hit;

  const segs: string[] = [];
  let cur = '';
  let ok = path.length > 0;
  for (let i = 0; i < path.length && ok; i++) {
    const ch = path[i];
    if (ch === '.') {
      if (cur) segs.push(cur);
      else if (i === 0 || path[i - 1] === '.') ok = false;
      cur = '';
    } else if (ch === '[') {
      if (cur) segs.push(cur);
      cur = '';
      const end = path.indexOf(']', i);
      if (end < 0) { ok = false; break; }
      const inner = path.slice(i + 1, end).trim().replace(/^["']|["']$/g, '');
      if (!inner) { ok = false; break; }
      segs.push(inner);
      i = end;
      if (path[i + 1] === '.') i++; // "a[0].b"
    } else {
      cur += ch;
    }
  }
  if (cur) segs.push(cur);
  const result = ok && segs.length > 0 && !segs.some((s) => BLOCKED.has(s)) ? segs : null;

  if (cache.size >= MAX_CACHE) cache.clear();
  cache.set(path, result);
  return result;
}

const hasOwn = Object.prototype.hasOwnProperty;

export function getSegments(source: unknown, segs: readonly string[], from = 0): unknown {
  let cur: unknown = source;
  for (let i = from; i < segs.length; i++) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== 'object') return undefined;
    const s = segs[i];
    if (Array.isArray(cur)) {
      const idx = Number(s);
      cur = Number.isInteger(idx) ? cur[idx] : s === 'length' ? cur.length : undefined;
    } else {
      cur = hasOwn.call(cur, s) ? (cur as Record<string, unknown>)[s] : undefined;
    }
  }
  return cur;
}

export function getPath(source: unknown, path: string): unknown {
  const segs = parsePath(path);
  return segs ? getSegments(source, segs) : undefined;
}
