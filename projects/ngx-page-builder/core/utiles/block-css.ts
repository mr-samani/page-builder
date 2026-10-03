/**
 * منطق خالص (بدون وابستگی به DOM/Angular) برای استایل بلاک‌ها.
 * هم designer (ClassManagerService) و هم preview/publish از همین توابع استفاده می‌کنند
 * تا نتیجه‌ی ادیتور و خروجی نهایی دقیقاً یکی باشد.
 *
 * مدل داده (item.css):
 *   {
 *     base:   "color:red;",                       // breakpoint پایه، حالت normal
 *     states: { hover: "color:blue;" },           // breakpoint پایه، حالت‌ها
 *     breakpoints: {
 *       md: { base: "...", states: { hover: "..." } }
 *     }
 *   }
 */
import {
  BlockCss,
  BlockCssChunk,
  BreakPointKey,
  Breakpoint,
  DEFAULT_BASE_BREAKPOINT_KEY,
  DEFAULT_BREAKPOINTS,
  PseudoState,
} from '../contracts/IStyleSheetFile';
import { ICssVariable } from '../contracts/ICssVariable';

//==================================================================================
// Types & constants
//==================================================================================

export interface BreakpointSetup {
  list: readonly Breakpoint[];
  /** کلید breakpointی که بدون media query اعمال می‌شود */
  baseKey: BreakPointKey;
}

export const DEFAULT_BREAKPOINT_SETUP: BreakpointSetup = {
  list: DEFAULT_BREAKPOINTS,
  baseKey: DEFAULT_BASE_BREAKPOINT_KEY,
};

/** یک «نقطه‌ی ویرایش»: کدام breakpoint و کدام حالت */
export interface BlockCssContext {
  bp: BreakPointKey;
  state: PseudoState;
}

export type RealPseudoState = Exclude<PseudoState, 'none'>;

/**
 * ترتیب قطعی شبه‌کلاس‌ها در خروجی.
 * چون specificity همه‌ی آن‌ها برابر است، آنی که دیرتر بیاید برنده است
 * (مثلاً active باید از hover قوی‌تر باشد — قاعده‌ی LVHA).
 */
export const PSEUDO_ORDER: readonly RealPseudoState[] = [
  'visited',
  'hover',
  'focus',
  'focus-visible',
  'active',
  'checked',
  'disabled',
];
const PSEUDO_RANK = new Map<PseudoState, number>(PSEUDO_ORDER.map((s, i) => [s, i]));
export function pseudoRank(state: PseudoState): number {
  return state === 'none' ? -1 : (PSEUDO_RANK.get(state) ?? PSEUDO_ORDER.length);
}

/** قبل از max-width یک مقدار اعشاری کم می‌کنیم تا با min-width بعدی همپوشانی نداشته باشد (مثل Bootstrap) */
const MAX_WIDTH_EPSILON = 0.02;

const BLOCK_CLASS_PREFIX = 'blk-';
const SAFE_ID = /[^A-Za-z0-9_-]/g;
const SAFE_PROP = /^(--[A-Za-z0-9_\u00A0-\uFFFF-]+|[a-z-]+)$/;
const SAFE_CSS_VAR_NAME = /^[A-Za-z0-9_-]+$/;

//==================================================================================
// Declarations parse / stringify  ("color:red;font-size:14px;" <-> Map)
//==================================================================================

function normProp(prop: string): string {
  // custom property ها case-sensitive هستند
  return prop.startsWith('--') ? prop : prop.toLowerCase();
}

/** parse بدون regex؛ کوتیشن و پرانتز (url(), calc(), var(--x,;)) را رعایت می‌کند */
export function parseDecls(text: string | undefined | null): Map<string, string> {
  const out = new Map<string, string>();
  if (!text) return out;

  let start = 0;
  let depth = 0;
  let quote = '';
  const flush = (end: number) => {
    const part = text.slice(start, end);
    const i = part.indexOf(':');
    if (i > 0) {
      const prop = normProp(part.slice(0, i).trim());
      const value = part.slice(i + 1).trim();
      if (prop && value) out.set(prop, value);
    }
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')' && depth > 0) depth--;
    else if (ch === ';' && depth === 0) {
      flush(i);
      start = i + 1;
    }
  }
  flush(text.length);
  return out;
}

export function stringifyDecls(map: Map<string, string>): string {
  let out = '';
  for (const [k, v] of map) out += `${k}:${v};`;
  return out;
}

/**
 * جلوگیری از تزریق CSS: اسم property باید ساده باشد و مقدار نباید
 * چیزی شبیه بستن rule، شروع rule جدید یا کامنت داشته باشد.
 */
export function isSafeDecl(prop: string, value: string): boolean {
  if (!SAFE_PROP.test(prop)) return false;
  let quote = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '{' || ch === '}' || ch === '<' || ch === '>') return false;
    else if (ch === '/' && value[i + 1] === '*') return false;
  }
  return !quote;
}

/** متن declaration را پاک‌سازی می‌کند و فقط موارد امن را نگه می‌دارد */
export function sanitizeDecls(text: string | undefined | null): string {
  const map = parseDecls(text);
  for (const [k, v] of map) if (!isSafeDecl(k, v)) map.delete(k);
  return stringifyDecls(map);
}

//==================================================================================
// Breakpoints
//==================================================================================

function sortedList(setup: BreakpointSetup): Breakpoint[] {
  return [...setup.list].sort((a, b) => a.minWidth - b.minWidth);
}

export function findBreakpoint(setup: BreakpointSetup, key: BreakPointKey): Breakpoint | undefined {
  return setup.list.find((b) => b.key === key);
}

export function isBaseBreakpoint(setup: BreakpointSetup, key: BreakPointKey): boolean {
  return key === setup.baseKey;
}

/**
 * شرط media query برای یک breakpoint، یا null برای breakpoint پایه.
 *  - بزرگ‌تر از پایه: (min-width: X)
 *  - کوچک‌تر از پایه: (max-width: minWidth breakpoint بعدی − ε)
 */
export function mediaCondition(setup: BreakpointSetup, key: BreakPointKey): string | null {
  if (key === setup.baseKey) return null;
  const list = sortedList(setup);
  const base = list.find((b) => b.key === setup.baseKey);
  const target = list.find((b) => b.key === key);
  if (!base || !target) return null;

  if (target.minWidth > base.minWidth) return `(min-width:${target.minWidth}px)`;

  const larger = list.find((b) => b.minWidth > target.minWidth);
  return larger ? `(max-width:${+(larger.minWidth - MAX_WIDTH_EPSILON).toFixed(2)}px)` : null;
}

/**
 * ترتیب قرارگیری media ها در stylesheet (ایندکس کوچک‌تر = زودتر).
 * [کوچک‌ترین‌ها ... نزدیک به پایه]، بعد [بزرگ‌تر از پایه، صعودی].
 * تا در هر گروه، breakpointِ «نزدیک‌تر به خودِ کاربر» دیرتر بیاید و برنده شود.
 */
export function mediaRank(setup: BreakpointSetup, key: BreakPointKey): number {
  const list = sortedList(setup);
  const base = list.find((b) => b.key === setup.baseKey);
  const target = list.find((b) => b.key === key);
  if (!base || !target) return Number.MAX_SAFE_INTEGER;
  // کوچک‌ترین‌ها (max-width) ← بزرگ‌ترین max اول، کوچک‌ترین آخر تا در widthهای کوچک override شود
  if (target.minWidth < base.minWidth) return -target.minWidth;
  return target.minWidth;
}

/**
 * زنجیره‌ی ارث‌بری برای یک breakpoint (از پایه تا خودش):
 *  xl(base) → [xl]
 *  xxl      → [xl, xxl]
 *  md       → [xl, lg, md]
 */
export function cascadeChain(setup: BreakpointSetup, key: BreakPointKey): BreakPointKey[] {
  const list = sortedList(setup);
  const base = list.find((b) => b.key === setup.baseKey);
  const target = list.find((b) => b.key === key);
  if (!base || !target || key === setup.baseKey) return [setup.baseKey];

  if (target.minWidth > base.minWidth) {
    return [
      base.key,
      ...list.filter((b) => b.minWidth > base.minWidth && b.minWidth <= target.minWidth).map((b) => b.key),
    ];
  }
  return [
    base.key,
    ...list
      .filter((b) => b.minWidth < base.minWidth && b.minWidth >= target.minWidth)
      .sort((a, b) => b.minWidth - a.minWidth)
      .map((b) => b.key),
  ];
}

//==================================================================================
// Read / write chunks of item.css
//==================================================================================

/** css قدیمی ممکن است string بوده باشد */
export function normalizeBlockCss(css: BlockCss | string | undefined | null): BlockCss | undefined {
  if (!css) return undefined;
  if (typeof css === 'string') return css.trim() ? { base: css } : undefined;
  return css;
}

function getChunk(css: BlockCss | undefined, setup: BreakpointSetup, bp: BreakPointKey): BlockCssChunk | undefined {
  if (!css) return undefined;
  return bp === setup.baseKey ? css : css.breakpoints?.[bp];
}

export function getChunkText(css: BlockCss | undefined, setup: BreakpointSetup, ctx: BlockCssContext): string {
  const chunk = getChunk(css, setup, ctx.bp);
  if (!chunk) return '';
  return (ctx.state === 'none' ? chunk.base : chunk.states?.[ctx.state]) ?? '';
}

/** متن یک context را می‌نویسد و ساختارهای خالی را پاک می‌کند تا item.css سبک بماند */
export function setChunkText(css: BlockCss, setup: BreakpointSetup, ctx: BlockCssContext, text: string): void {
  const isBase = ctx.bp === setup.baseKey;
  let chunk: BlockCssChunk | undefined = getChunk(css, setup, ctx.bp);

  if (!text) {
    if (!chunk) return;
    if (ctx.state === 'none') delete chunk.base;
    else if (chunk.states) {
      delete chunk.states[ctx.state];
      if (!Object.keys(chunk.states).length) delete chunk.states;
    }
    if (!isBase && !chunk.base && !chunk.states) {
      delete css.breakpoints![ctx.bp];
      if (!Object.keys(css.breakpoints!).length) delete css.breakpoints;
    }
    return;
  }

  if (!chunk) {
    css.breakpoints ??= {};
    chunk = css.breakpoints[ctx.bp] = {};
  }
  if (ctx.state === 'none') chunk.base = text;
  else (chunk.states ??= {})[ctx.state] = text;
}

export function isBlockCssEmpty(css: BlockCss | undefined): boolean {
  return !css || (!css.base && !css.states && !css.breakpoints);
}

/** همه‌ی contextهایی که در css مقدار دارند */
export function listContexts(css: BlockCss | undefined, setup: BreakpointSetup): BlockCssContext[] {
  const result: BlockCssContext[] = [];
  if (!css) return result;
  const visit = (bp: BreakPointKey, chunk?: BlockCssChunk) => {
    if (!chunk) return;
    if (chunk.base) result.push({ bp, state: 'none' });
    for (const s of Object.keys(chunk.states ?? {}) as PseudoState[]) result.push({ bp, state: s });
  };
  visit(setup.baseKey, css);
  for (const k of Object.keys(css.breakpoints ?? {}) as BreakPointKey[]) visit(k, css.breakpoints![k]);
  return result;
}

/**
 * مقدار «مؤثر» یک context با در نظر گرفتن ارث‌بری (مثل Webflow):
 *  - normal: base → breakpointهای میانی → خود breakpoint
 *  - state:  مقدار normal مؤثر، سپس همان state از پایه تا خود breakpoint
 */
export function resolveDecls(
  css: BlockCss | undefined,
  setup: BreakpointSetup,
  ctx: BlockCssContext,
): Map<string, string> {
  const out = new Map<string, string>();
  if (!css) return out;
  const chain = cascadeChain(setup, ctx.bp);
  const merge = (text?: string) => {
    if (!text) return;
    for (const [k, v] of parseDecls(text)) out.set(k, v);
  };
  for (const k of chain) merge(getChunk(css, setup, k)?.base);
  if (ctx.state !== 'none') {
    for (const k of chain) merge(getChunk(css, setup, k)?.states?.[ctx.state]);
  }
  return out;
}

//==================================================================================
// Block class name
//==================================================================================

/** کلاس اختصاصی بلاک؛ باید با ensureBlockClassName در ClassManagerService یکی باشد */
export function getBlockClass(item: { id?: string; classList?: string[] }): string {
  const existing = item.classList?.find((c) => c.startsWith(BLOCK_CLASS_PREFIX));
  return existing ?? `${BLOCK_CLASS_PREFIX}${item.id ?? ''}`;
}
export function isBlockClass(name: string): boolean {
  return name.startsWith(BLOCK_CLASS_PREFIX);
}

//==================================================================================
// Compile → CSS text (برای preview / publish / export / snapshot)
//==================================================================================

interface CssTreeNode {
  id?: string;
  classList?: string[];
  css?: BlockCss | string;
  children?: CssTreeNode[];
  template?: CssTreeNode;
}

class CssSink {
  root: string[] = [];
  media = new Map<BreakPointKey, string[]>();
  bucket(bp: BreakPointKey, setup: BreakpointSetup): string[] {
    if (bp === setup.baseKey) return this.root;
    let list = this.media.get(bp);
    if (!list) this.media.set(bp, (list = []));
    return list;
  }
}

function emitChunk(selector: string, chunk: BlockCssChunk | undefined, into: string[]): void {
  if (!chunk) return;
  const base = sanitizeDecls(chunk.base);
  if (base) into.push(`${selector}{${base}}`);
  if (!chunk.states) return;
  for (const s of PSEUDO_ORDER) {
    const text = sanitizeDecls(chunk.states[s]);
    if (text) into.push(`${selector}:${s}{${text}}`);
  }
}

function collect(node: CssTreeNode, setup: BreakpointSetup, sink: CssSink): void {
  const css = normalizeBlockCss(node.css);
  if (css) {
    const cls = getBlockClass(node).replace(SAFE_ID, '');
    const selector = `.${cls}`;
    emitChunk(selector, css, sink.root);
    for (const key of Object.keys(css.breakpoints ?? {}) as BreakPointKey[]) {
      if (key === setup.baseKey || !findBreakpoint(setup, key)) continue;
      emitChunk(selector, css.breakpoints![key], sink.bucket(key, setup));
    }
  }
  if (node.children) for (const c of node.children) collect(c, setup, sink);
  if (node.template) collect(node.template, setup, sink);
}

/** CSS متغیرها به‌صورت `:root{--x:..}` */
export function compileCssVariables(vars: readonly ICssVariable[] | undefined): string {
  if (!vars?.length) return '';
  let body = '';
  for (const v of vars) {
    if (!v?.name || !SAFE_CSS_VAR_NAME.test(v.name)) continue;
    if (!isSafeDecl(`--${v.name}`, String(v.value ?? ''))) continue;
    body += `--${v.name}:${v.value};`;
  }
  return body ? `:root{${body}}` : '';
}

/** استایل کل درخت بلاک‌ها (base + state ها + media ها) */
export function compileBlocksCss(
  roots: readonly CssTreeNode[],
  setup: BreakpointSetup = DEFAULT_BREAKPOINT_SETUP,
): string {
  const sink = new CssSink();
  for (const r of roots) collect(r, setup, sink);

  let out = sink.root.join('');
  const keys = [...sink.media.keys()].sort((a, b) => mediaRank(setup, a) - mediaRank(setup, b));
  for (const k of keys) {
    const cond = mediaCondition(setup, k);
    const rules = sink.media.get(k)!;
    if (cond && rules.length) out += `@media ${cond}{${rules.join('')}}`;
  }
  return out;
}

/** استایل کامل یک خروجی صفحه‌ساز (همه‌ی صفحات) + متغیرهای CSS */
export function compilePagesCss(
  pages: readonly { headerItems?: CssTreeNode[]; bodyItems?: CssTreeNode[]; footerItems?: CssTreeNode[] }[],
  cssVariables?: readonly ICssVariable[],
  setup: BreakpointSetup = DEFAULT_BREAKPOINT_SETUP,
): string {
  const roots: CssTreeNode[] = [];
  for (const p of pages ?? []) roots.push(...(p.headerItems ?? []), ...(p.bodyItems ?? []), ...(p.footerItems ?? []));
  return compileCssVariables(cssVariables) + compileBlocksCss(roots, setup);
}

export const BLOCK_STYLE_ELEMENT_ID = 'NgxPageBuilderBlockStyles';

/**
 * استایل بلاک‌ها را به‌صورت یک <style> در انتهای head قرار می‌دهد (اگر قبلاً بوده، جایگزین و به انتها منتقل می‌شود)
 * چون این استایل unlayered است، باید بعد از Bootstrap و فایل‌های کاربر بیاید تا برنده شود.
 */
export function applyBlockStylesToDocument(
  doc: Document,
  pages: Parameters<typeof compilePagesCss>[0],
  cssVariables?: readonly ICssVariable[],
  setup: BreakpointSetup = DEFAULT_BREAKPOINT_SETUP,
): void {
  doc.getElementById(BLOCK_STYLE_ELEMENT_ID)?.remove();
  const css = compilePagesCss(pages, cssVariables, setup);
  if (!css) return;
  const el = doc.createElement('style');
  el.id = BLOCK_STYLE_ELEMENT_ID;
  el.textContent = css;
  doc.head.appendChild(el);
}
