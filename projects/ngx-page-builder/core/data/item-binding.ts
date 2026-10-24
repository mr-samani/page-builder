import { compileTemplate, type CompiledTemplate, type EscapeMode } from './template';
import type { DataScope } from './scope';
import { isUnsafeUrl } from './url-safety';

/**
 * What a block shows from the record it is bound to. All values are templates (`{{title}}`, `{{price | currency:'USD'}}`).
 * Text is written with textContent (safe by default); attributes are guarded against javascript: URLs.
 */
export interface ItemBinding {
  /** text of the block; with `html: true` it is treated as markup (substituted values are still escaped) */
  content?: string;
  html?: boolean;
  /** `src`, `href`, `alt`, `title`, `value`, `data-*` … */
  attrs?: Record<string, string>;
  /** `{ 'is-sale': '{{onSale}}' }` → the class is present while the template is truthy */
  classes?: Record<string, string>;
  /** inline style properties: `{ 'background-image': 'url("{{image}}")' }` */
  styles?: Record<string, string>;
  /** visible only while truthy / hidden while truthy */
  showIf?: string;
  hideIf?: string;
}

/** The parts of a block the binding layer looks at (PageItem satisfies this). */
export interface BindableItem {
  tag?: string;
  binding?: ItemBinding;
  dataSource?: { binding?: string } | null;
  options?: { attributes?: Record<string, string>; customData?: { queryString?: LegacyQueryItem[] } & Record<string, unknown> } | null;
}

export interface LegacyQueryItem {
  key?: string;
  value?: string;
  isDynamic?: boolean;
}

export interface CompiledBinding {
  readonly content?: CompiledTemplate;
  readonly html: boolean;
  readonly attrs: readonly (readonly [string, CompiledTemplate])[];
  readonly classes: readonly (readonly [string, CompiledTemplate])[];
  readonly styles: readonly (readonly [string, CompiledTemplate])[];
  readonly showIf?: CompiledTemplate;
  readonly hideIf?: CompiledTemplate;
  /** record fields read (for server-side projection) */
  readonly fields: readonly string[];
  readonly usesWholeRow: boolean;
  readonly usesParent: boolean;
  /** fields of the PARENT record read through `parent.x` (they must be projected by the parent request) */
  readonly parentFields: readonly string[];
  /** reads $index / $count / $first / $last … (rows must be re-bound when the list length changes) */
  readonly usesLoop: boolean;
}

const SRC_TAGS = new Set(['img', 'source', 'video', 'audio', 'iframe', 'embed', 'track']);
const VALUE_TAGS = new Set(['input', 'textarea', 'select', 'option', 'button']);
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'poster', 'data', 'xlink:href', 'background', 'cite']);

/** `{{x}}` templates for the old `dataSource.binding` + dynamic link query strings. */
export function legacyBinding(item: BindableItem): ItemBinding | undefined {
  const out: ItemBinding = {};
  const field = item.dataSource?.binding;
  if (field) {
    const tpl = `{{${field}}}`;
    const tag = (item.tag ?? '').toLowerCase();
    if (SRC_TAGS.has(tag)) out.attrs = { ...out.attrs, src: tpl };
    else if (VALUE_TAGS.has(tag) && tag !== 'button') out.attrs = { ...out.attrs, value: tpl };
    else out.content = tpl;
  }
  const href = legacyHrefTemplate(item);
  if (href) out.attrs = { ...out.attrs, href };
  return out.content || out.attrs ? out : undefined;
}

/** `/page?id={{id | url}}&tab=info` from the link editor's query-string list (only when something is dynamic). */
export function legacyHrefTemplate(item: BindableItem): string | undefined {
  const qs = item.options?.customData?.queryString;
  if (!Array.isArray(qs) || !qs.some((q) => q?.isDynamic && q.value)) return undefined;
  return composeHref(item.options?.attributes?.['href'] ?? '', qs, true);
}

/** The href for links without dynamic parts, built once at render time (encoded, no dangling "?", hash kept last). */
export function buildStaticHref(item: BindableItem): string | undefined {
  const base = item.options?.attributes?.['href'];
  const qs = item.options?.customData?.queryString;
  if (!Array.isArray(qs) || qs.length === 0) return undefined;
  if (qs.some((q) => q?.isDynamic)) return undefined; // dynamic ones are handled by the row binding
  const href = composeHref(base ?? '', qs, false);
  return href === (base ?? '') ? undefined : href;
}

function composeHref(base: string, qs: readonly LegacyQueryItem[], dynamic: boolean): string {
  const hashAt = base.indexOf('#');
  const hash = hashAt >= 0 ? base.slice(hashAt) : '';
  let path = hashAt >= 0 ? base.slice(0, hashAt) : base;
  const pairs: string[] = [];
  for (const q of qs) {
    if (!q?.key || q.value === undefined || q.value === '') continue;
    const k = encodeURIComponent(q.key);
    pairs.push(q.isDynamic && dynamic ? `${k}={{${q.value} | url}}` : `${k}=${encodeURIComponent(q.value)}`);
  }
  if (pairs.length) path += (path.includes('?') ? '&' : '?') + pairs.join('&');
  return path + hash;
}

/** Union of the explicit `item.binding` (wins) and the legacy fields. */
export function resolveBinding(item: BindableItem): ItemBinding | undefined {
  const legacy = legacyBinding(item);
  const b = item.binding;
  if (!b) return legacy;
  if (!legacy) return b;
  return {
    ...b,
    content: b.content ?? legacy.content,
    attrs: { ...legacy.attrs, ...b.attrs },
  };
}

const EMPTY: CompiledBinding = Object.freeze({ html: false, attrs: [], classes: [], styles: [], fields: [], usesWholeRow: false, usesParent: false, parentFields: [], usesLoop: false });

export function compileBinding(b: ItemBinding | undefined): CompiledBinding {
  if (!b) return EMPTY;
  const entries = (o?: Record<string, string>) =>
    Object.entries(o ?? {})
      .filter(([k, v]) => k && typeof v === 'string' && v !== '')
      .map(([k, v]) => [k, compileTemplate(v)] as const);

  const attrs = entries(b.attrs);
  const classes = entries(b.classes);
  const styles = entries(b.styles);
  const content = typeof b.content === 'string' && b.content !== '' ? compileTemplate(b.content) : undefined;
  const showIf = b.showIf ? compileTemplate(b.showIf) : undefined;
  const hideIf = b.hideIf ? compileTemplate(b.hideIf) : undefined;

  const all: CompiledTemplate[] = [...(content ? [content] : []), ...attrs.map((a) => a[1]), ...classes.map((a) => a[1]), ...styles.map((a) => a[1]), ...(showIf ? [showIf] : []), ...(hideIf ? [hideIf] : [])];
  const fields = new Set<string>();
  const parentFields = new Set<string>();
  let whole = false;
  let parent = false;
  let loop = false;
  for (const t of all) {
    loop ||= t.roots.some((r) => r.startsWith('$'));
    t.fields.forEach((f) => fields.add(f));
    whole ||= t.usesWholeRow;
    parent ||= t.usesParent;
    t.parentFields.forEach((f) => parentFields.add(f));
  }
  if (!all.length) return EMPTY;
  return { content, html: !!b.html, attrs, classes, styles, showIf, hideIf, fields: [...fields], usesWholeRow: whole, usesParent: parent, parentFields: [...parentFields], usesLoop: loop };
}

export function isEmptyBinding(c: CompiledBinding): boolean {
  return c === EMPTY || (!c.content && !c.attrs.length && !c.classes.length && !c.styles.length && !c.showIf && !c.hideIf);
}

/** What was last written, so unchanged values never touch the DOM. */
export interface BoundValues {
  content?: string;
  attrs?: (string | null)[];
  classes?: boolean[];
  styles?: string[];
  hidden?: boolean;
}

export function isTruthy(v: unknown): boolean {
  if (v === null || v === undefined || v === false || v === 0) return false;
  if (typeof v === 'number' && Number.isNaN(v)) return false;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return !(s === '' || s === 'false' || s === '0' || s === 'null' || s === 'undefined');
  }
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function attrMode(name: string, t: CompiledTemplate): EscapeMode {
  // "/product/{{slug}}" → the substituted value is a path segment: encode it.  "{{url}}" is a whole URL: keep it.
  return URL_ATTRS.has(name) && !t.source.trimStart().startsWith('{{') ? 'url' : 'attr';
}

export interface ApplyOptions {
  /** sanitizer for `html: true` content (DOMPurify, Ganss.Xss on the server …) */
  sanitizeHtml?: (html: string) => string;
}

/**
 * Writes a record into an element. Returns the new BoundValues (store it and pass it back next time).
 * Only values that CHANGED touch the DOM.
 */
export function applyBinding(el: Element, b: CompiledBinding, scope: DataScope, last: BoundValues = {}, opts: ApplyOptions = {}): BoundValues {
  const next: BoundValues = { attrs: last.attrs ?? [], classes: last.classes ?? [], styles: last.styles ?? [] };

  if (b.showIf || b.hideIf) {
    let visible = true;
    if (b.showIf) visible = isTruthy(b.showIf.evaluate(scope));
    if (visible && b.hideIf) visible = !isTruthy(b.hideIf.evaluate(scope));
    const hidden = !visible;
    if (hidden !== last.hidden) setHidden(el as HTMLElement, hidden);
    next.hidden = hidden;
  }

  if (b.content) {
    let value = b.content.render(scope, b.html ? 'html' : 'text');
    if (b.html && opts.sanitizeHtml) value = opts.sanitizeHtml(value);
    if (value !== last.content) {
      if (b.html) el.innerHTML = value;
      else el.textContent = value;
    }
    next.content = value;
  }

  for (let i = 0; i < b.attrs.length; i++) {
    const [name, tpl] = b.attrs[i];
    let value: string | null = tpl.renderOrEmpty(scope, attrMode(name, tpl));
    if (URL_ATTRS.has(name) && value !== '' && isUnsafeUrl(value, el.tagName.toLowerCase(), name)) value = '';
    // an empty src/href would make the browser request the page itself → remove the attribute instead
    if (value === '' && (URL_ATTRS.has(name) || name === 'srcset')) value = null;
    if (value !== (last.attrs?.[i] ?? undefined)) {
      if (value === null) el.removeAttribute(name);
      else el.setAttribute(name, value);
    }
    next.attrs![i] = value;
  }

  for (let i = 0; i < b.classes.length; i++) {
    const [cls, tpl] = b.classes[i];
    const on = isTruthy(tpl.evaluate(scope));
    if (on !== last.classes?.[i]) el.classList.toggle(cls, on);
    next.classes![i] = on;
  }

  for (let i = 0; i < b.styles.length; i++) {
    const [prop, tpl] = b.styles[i];
    const value = tpl.renderOrEmpty(scope, 'attr');
    if (value !== last.styles?.[i]) {
      if (value) (el as HTMLElement).style.setProperty(prop, value);
      else (el as HTMLElement).style.removeProperty(prop);
    }
    next.styles![i] = value;
  }
  return next;
}

function setHidden(el: HTMLElement, hidden: boolean): void {
  if (hidden) {
    if (el.dataset['pbDisplay'] === undefined) el.dataset['pbDisplay'] = el.style.display || '';
    el.style.display = 'none';
    el.setAttribute('aria-hidden', 'true');
  } else {
    el.style.display = el.dataset['pbDisplay'] ?? '';
    delete el.dataset['pbDisplay'];
    el.removeAttribute('aria-hidden');
  }
}
