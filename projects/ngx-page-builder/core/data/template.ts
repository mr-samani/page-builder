import { applyFormatter, SafeString } from './format';
import { getSegments, parsePath } from './path';
import { resolveSegments, SCOPE_ROOTS, type DataScope } from './scope';

/**
 * `{{ path ?? 'fallback' | pipe:arg | pipe2 }}` templates.
 *
 * - compiled ONCE (LRU cache) and rendered for every row → no regex / parsing in the hot loop
 * - `text` / `attr` mode returns the plain string, `html` mode HTML-escapes every substituted value
 *   (the literal parts are the author's markup and stay untouched), `url` mode percent-encodes substituted values
 * - unknown paths render as '' (or the `??` fallback); a malformed `{{…}}` is kept as literal text; nothing throws
 */
export type EscapeMode = 'text' | 'attr' | 'html' | 'url';

interface Pipe {
  name: string;
  args: unknown[];
}
interface Token {
  kind: 'token';
  path: string;
  segs: readonly string[];
  hasFallback: boolean;
  fallback: unknown;
  pipes: Pipe[];
}
type Part = string | Token;

export interface CompiledTemplate {
  readonly source: string;
  readonly isStatic: boolean;
  readonly isSingleToken: boolean;
  /** record fields (root names) the template reads — lets the request ask the server for only these */
  readonly fields: readonly string[];
  /** true when the whole record is referenced (`{{row}}`, `{{row | json}}`) → no field projection is possible */
  readonly usesWholeRow: boolean;
  /** every scope root used (route, query, parent, row …) */
  readonly roots: readonly string[];
  readonly usesRow: boolean;
  readonly usesParent: boolean;
  /** fields read through `parent.x` — the PARENT collection must project them */
  readonly parentFields: readonly string[];
  render(scope: DataScope, mode?: EscapeMode): string;
  /** like render(), but returns '' when the template has tokens and ALL of them are empty (so `url("{{image}}")` / `/p/{{slug}}` vanish instead of becoming `url("")` / `/p/`) */
  renderOrEmpty(scope: DataScope, mode?: EscapeMode): string;
  /** typed value of a single-token template (`@route.page` style); falls back to render() otherwise */
  evaluate(scope: DataScope): unknown;
}

//---------------------------------------------------------------- literals / scanning

function parseLiteral(raw: string): unknown {
  const s = raw.trim();
  if (s.length >= 2 && ((s[0] === "'" && s.endsWith("'")) || (s[0] === '"' && s.endsWith('"')))) {
    return s.slice(1, -1).replace(/\\(['"\\])/g, '$1');
  }
  if (s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s !== '' && !Number.isNaN(Number(s))) return Number(s);
  return s;
}

/** Splits `text` on `sep` ignoring separators inside quotes. */
function splitTop(text: string, sep: string): string[] {
  const out: string[] = [];
  let quote = '';
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === sep) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out;
}

function indexOfTop(text: string, needle: string): number {
  let quote = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = '';
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (text.startsWith(needle, i)) return i;
  }
  return -1;
}

/** `a b` is not a path, but `a["x y"]` is. */
function hasSpaceOutsideBrackets(s: string): boolean {
  let depth = 0;
  for (const ch of s) {
    if (ch === '[') depth++;
    else if (ch === ']') depth = Math.max(0, depth - 1);
    else if (depth === 0 && /\s/.test(ch)) return true;
  }
  return false;
}

function parseExpression(expr: string): Token | null {
  const pieces = splitTop(expr, '|');
  let head = pieces[0].trim();
  let hasFallback = false;
  let fallback: unknown = undefined;
  const q = indexOfTop(head, '??');
  if (q >= 0) {
    hasFallback = true;
    fallback = parseLiteral(head.slice(q + 2));
    head = head.slice(0, q).trim();
  }
  if (!head || hasSpaceOutsideBrackets(head)) return null;
  const segs = head.startsWith('$') ? [head] : parsePath(head);
  if (!segs) return null;

  const pipes: Pipe[] = [];
  for (let i = 1; i < pieces.length; i++) {
    const bits = splitTop(pieces[i].trim(), ':');
    const name = bits[0].trim();
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) return null;
    pipes.push({ name, args: bits.slice(1).map(parseLiteral) });
  }
  return { kind: 'token', path: head, segs, hasFallback, fallback, pipes };
}

function parse(source: string): Part[] {
  const parts: Part[] = [];
  let i = 0;
  let lit = '';
  while (i < source.length) {
    const open = source.indexOf('{{', i);
    if (open < 0) break;
    // find the matching "}}" (not inside quotes)
    let quote = '';
    let end = -1;
    for (let j = open + 2; j < source.length; j++) {
      const ch = source[j];
      if (quote) {
        if (ch === '\\') j++;
        else if (ch === quote) quote = '';
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '}' && source[j + 1] === '}') {
        end = j;
        break;
      }
    }
    if (end < 0) break;
    const tok = parseExpression(source.slice(open + 2, end));
    lit += source.slice(i, open);
    if (tok) {
      if (lit) parts.push(lit);
      lit = '';
      parts.push(tok);
    } else {
      lit += source.slice(open, end + 2); // malformed → keep as text
    }
    i = end + 2;
  }
  lit += source.slice(i);
  if (lit) parts.push(lit);
  return parts;
}

//---------------------------------------------------------------- rendering

export function toText(v: unknown): string {
  if (v === null || v === undefined) return '';
  switch (typeof v) {
    case 'string':
      return v;
    case 'number':
      return Number.isFinite(v) ? String(v) : '';
    case 'boolean':
      return v ? 'true' : 'false';
    case 'bigint':
      return v.toString();
  }
  if (v instanceof SafeString) return v.value;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v.toISOString();
  if (Array.isArray(v)) return v.map(toText).join(', ');
  return '';
}

const HTML_ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(s: string): string {
  return /[&<>"']/.test(s) ? s.replace(/[&<>"']/g, (c) => HTML_ESC[c]) : s;
}

function evalToken(t: Token, scope: DataScope): unknown {
  let v = resolveSegments(scope, t.segs);
  if ((v === null || v === undefined || v === '') && t.hasFallback) v = t.fallback;
  if (t.pipes.length) {
    const locale = scope.ctx.locale;
    for (const p of t.pipes) v = applyFormatter(p.name, v, p.args, locale);
  }
  return v;
}

function encode(v: unknown, mode: EscapeMode): string {
  if (v instanceof SafeString) return v.value;
  const s = toText(v);
  return mode === 'html' ? escapeHtml(s) : mode === 'url' ? encodeURIComponent(s) : s;
}

class Compiled implements CompiledTemplate {
  readonly isStatic: boolean;
  readonly isSingleToken: boolean;
  readonly fields: readonly string[];
  readonly usesWholeRow: boolean;
  readonly roots: readonly string[];
  readonly usesRow: boolean;
  readonly usesParent: boolean;
  readonly parentFields: readonly string[];
  private readonly literal: string;

  constructor(readonly source: string, private readonly parts: Part[]) {
    this.isStatic = parts.every((p) => typeof p === 'string');
    this.isSingleToken = parts.length === 1 && typeof parts[0] !== 'string';
    this.literal = this.isStatic ? parts.join('') : '';

    const fields = new Set<string>();
    const parentFields = new Set<string>();
    const roots = new Set<string>();
    let whole = false;
    for (const p of parts) {
      if (typeof p === 'string') continue;
      const root = p.segs[0];
      if (root.startsWith('$')) {
        roots.add(root);
        continue;
      }
      if (root === 'row') {
        roots.add('row');
        if (p.segs.length > 1) fields.add(p.segs[1]);
        else whole = true;
      } else if (SCOPE_ROOTS.has(root)) {
        roots.add(root);
        if (root === 'parent') {
          // parent.x → field x of the enclosing record; parent.parent.x is two levels up (not this collection's concern)
          if (p.segs.length > 1 && p.segs[1] !== 'parent') parentFields.add(p.segs[1]);
        }
      } else {
        roots.add('row');
        fields.add(root);
      }
    }
    this.fields = [...fields];
    this.usesWholeRow = whole;
    this.roots = [...roots];
    this.usesRow = roots.has('row');
    this.usesParent = roots.has('parent');
    this.parentFields = [...parentFields];
  }

  render(scope: DataScope, mode: EscapeMode = 'text'): string {
    if (this.isStatic) return this.literal;
    let out = '';
    for (const p of this.parts) {
      if (typeof p === 'string') out += p;
      else out += encode(evalToken(p, scope), mode);
    }
    return out;
  }

  renderOrEmpty(scope: DataScope, mode: EscapeMode = 'text'): string {
    if (this.isStatic) return this.literal;
    let out = '';
    let any = false;
    for (const p of this.parts) {
      if (typeof p === 'string') out += p;
      else {
        const text = encode(evalToken(p, scope), mode);
        if (text !== '') any = true;
        out += text;
      }
    }
    return any ? out : '';
  }

  evaluate(scope: DataScope): unknown {
    if (this.isSingleToken) return evalToken(this.parts[0] as Token, scope);
    return this.render(scope, 'text');
  }
}

const cache = new Map<string, Compiled>();
const MAX = 1000;

export function compileTemplate(source: string): CompiledTemplate {
  const s = source ?? '';
  let c = cache.get(s);
  if (c) {
    // refresh LRU position
    cache.delete(s);
    cache.set(s, c);
    return c;
  }
  c = new Compiled(s, s.includes('{{') ? parse(s) : s ? [s] : []);
  cache.set(s, c);
  if (cache.size > MAX) cache.delete(cache.keys().next().value as string);
  return c;
}

export function hasTemplate(s: unknown): s is string {
  return typeof s === 'string' && s.includes('{{');
}

/** Convenience: compile + render. */
export function renderTemplate(source: string, scope: DataScope, mode: EscapeMode = 'text'): string {
  return compileTemplate(source).render(scope, mode);
}

/** Reads a value without going through a template (used for typed `@ref` params). */
export function readRef(scope: DataScope, path: string): unknown {
  const segs = path.startsWith('$') ? [path] : parsePath(path);
  return segs ? resolveSegments(scope, segs) : undefined;
}

export { getSegments };
