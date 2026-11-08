/**
 * پاک‌سازی HTML «متن درون‌خطی» با whitelist (نه blacklist).
 *
 * چرا؟ خروجی contentEditable (و به‌خصوص paste از Word / وب) پر از تگ و attribute ی ناخواسته است
 * و چون `content` بلاک بعداً با innerHTML در صفحه‌ی نهایی رندر می‌شود، باید فقط موارد امن بماند.
 *
 * - تگ‌های مجاز: فرمت‌دهی درون‌خطی (b, i, u, s, span, a, sub, sup, mark, code, br, img ...)
 * - تگ‌های بلاکی (div, p, li, h1…) باز می‌شوند و بینشان `<br>` می‌آید تا متن به هم نچسبد
 * - script / style / iframe / form ... با محتوایشان حذف می‌شوند
 * - attribute ها: style (فقط property های متنی و مقدارهای امن)، class، href/src با پروتکل مجاز، title، alt ...
 * - هیچ‌وقت innerHTML روی ورودی خام ست نمی‌شود؛ درخت امن از صفر با createElement ساخته می‌شود.
 */

const ALLOWED_TAGS = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'del', 'em', 'i', 'img', 'ins', 'kbd', 'mark',
  'q', 's', 'samp', 'small', 'span', 'strike', 'strong', 'sub', 'sup', 'u', 'wbr',
]);

/** این تگ‌ها با همه‌ی محتوایشان دور ریخته می‌شوند */
const DROP_WITH_CONTENT = new Set([
  'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'noscript', 'template', 'link', 'meta',
  'title', 'head', 'base', 'svg', 'math', 'form', 'input', 'button', 'select', 'option', 'textarea', 'audio', 'video',
  'canvas', 'dialog', 'xml', 'o:p',
]);

/** تگ‌های بلاکی: باز می‌شوند و بعدشان <br> می‌آید */
const BLOCK_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'div', 'dl', 'dt', 'dd', 'fieldset', 'figure', 'figcaption', 'footer', 'h1',
  'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'tr', 'ul',
]);

const STYLE_ALLOWED = new Set([
  'color',
  'background-color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-decoration',
  'text-decoration-line',
  'text-decoration-color',
  'text-decoration-style',
  'text-transform',
  'letter-spacing',
  'word-spacing',
  'vertical-align',
  'line-height',
]);

const SAFE_URL = /^(?:https?:|mailto:|tel:|#|\/(?!\/)|\.{0,2}\/|[^:]*$)/i;
const SAFE_DATA_IMG = /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i;
const SAFE_CLASS = /^[\w\s:-]*$/;
const UNSAFE_STYLE_VALUE = /url\s*\(|expression|javascript:|@import|behavior|-moz-binding|[{}<>\\]/i;

/** مقدار URL را امن می‌کند؛ نامعتبر → '' */
export function safeUrl(value: string | null | undefined, allowDataImage = false): string {
  const v = (value ?? '').trim();
  if (!v) return '';
  // کاراکترهای کنترلی/فاصله داخل پروتکل (مثل "java\tscript:") را حذف می‌کنیم
  const compact = v.replace(/[\u0000-\u0020\u007f-\u009f]+/g, '');
  if (allowDataImage && SAFE_DATA_IMG.test(v)) return v;
  return SAFE_URL.test(compact) ? v : '';
}

function copyStyle(from: HTMLElement, to: HTMLElement): void {
  const st = from.style;
  if (!st) return;
  for (let i = 0; i < st.length; i++) {
    const prop = st[i];
    if (!STYLE_ALLOWED.has(prop)) continue;
    const val = st.getPropertyValue(prop).trim();
    if (!val || UNSAFE_STYLE_VALUE.test(val)) continue;
    to.style.setProperty(prop, val);
  }
}

function copyAttributes(from: HTMLElement, to: HTMLElement, tag: string): void {
  copyStyle(from, to);

  const cls = from.getAttribute('class');
  if (cls && SAFE_CLASS.test(cls)) to.setAttribute('class', cls.trim());

  const title = from.getAttribute('title');
  if (title) to.setAttribute('title', title);
  const dir = from.getAttribute('dir');
  if (dir === 'rtl' || dir === 'ltr') to.setAttribute('dir', dir);
  const lang = from.getAttribute('lang');
  if (lang && /^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(lang)) to.setAttribute('lang', lang);

  if (tag === 'a') {
    const href = safeUrl(from.getAttribute('href'));
    if (href) to.setAttribute('href', href);
    const target = from.getAttribute('target');
    if (target === '_blank') {
      to.setAttribute('target', '_blank');
      to.setAttribute('rel', 'noopener noreferrer');
    }
  } else if (tag === 'img') {
    const src = safeUrl(from.getAttribute('src'), true);
    if (src) to.setAttribute('src', src);
    const alt = from.getAttribute('alt');
    if (alt !== null) to.setAttribute('alt', alt);
    for (const a of ['width', 'height']) {
      const v = from.getAttribute(a);
      if (v && /^\d{1,5}%?$/.test(v)) to.setAttribute(a, v);
    }
  }
}

function build(src: Node, out: Node, doc: Document): void {
  for (let n = src.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === Node.TEXT_NODE) {
      out.appendChild(doc.createTextNode(n.nodeValue ?? ''));
      continue;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) continue; // comment / CDATA / PI

    const el = n as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (DROP_WITH_CONTENT.has(tag) || tag.startsWith('o:') || tag.startsWith('v:')) continue;

    if (tag === 'font') {
      // <font color face> (خروجی قدیمی execCommand) → span با style
      const span = doc.createElement('span');
      const color = el.getAttribute('color');
      const face = el.getAttribute('face');
      if (color && !UNSAFE_STYLE_VALUE.test(color)) span.style.color = color;
      if (face && !UNSAFE_STYLE_VALUE.test(face)) span.style.fontFamily = face;
      copyStyle(el, span);
      build(el, span, doc);
      out.appendChild(span);
      continue;
    }

    if (BLOCK_TAGS.has(tag)) {
      if (tag === 'hr') {
        out.appendChild(doc.createElement('br'));
        continue;
      }
      // قبل از بلاک اگر متنی هست، شکست خط بگذار تا به قبلی نچسبد
      if (out.lastChild && out.lastChild.nodeName !== 'BR') out.appendChild(doc.createElement('br'));
      build(el, out, doc);
      if (el.nextSibling) out.appendChild(doc.createElement('br'));
      continue;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      // تگ ناشناخته: محتوایش را نگه دار
      build(el, out, doc);
      continue;
    }

    const clean = doc.createElement(tag);
    copyAttributes(el, clean, tag);

    if (tag === 'a' && !clean.hasAttribute('href')) {
      // لینک بدون href معنایی ندارد → فقط محتوا
      build(el, out, doc);
      continue;
    }
    if (tag === 'img' && !clean.hasAttribute('src')) continue;

    if (tag !== 'br' && tag !== 'img' && tag !== 'wbr') build(el, clean, doc);

    // span بدون هیچ attribute (و بدون اثر) → باز کن
    if (tag === 'span' && clean.attributes.length === 0) {
      while (clean.firstChild) out.appendChild(clean.firstChild);
      continue;
    }
    out.appendChild(clean);
  }
}

/** فاصله‌ی غیرقابل‌شکست و Zero-width که contentEditable گاهی اضافه می‌کند */
function tidy(root: HTMLElement): void {
  // یک <br> انتهایی (placeholder ی مرورگر) هیچ اثر دیداری ندارد
  const last = root.lastChild;
  if (last && last.nodeName === 'BR') root.removeChild(last);
  root.normalize();
}

/**
 * @param html     HTML خام (innerHTML ی المنت یا clipboard)
 * @param targetDoc سندی که المنت‌ها در آن ساخته می‌شوند (document ی iframe ی کَنوَس)
 */
export function sanitizeInlineHtml(html: string | null | undefined, targetDoc: Document = document): string {
  if (!html) return '';
  const parsed = new DOMParser().parseFromString(`<body>${html}`, 'text/html').body;
  const out = targetDoc.createElement('div');
  build(parsed, out, targetDoc);
  tidy(out);
  return out.innerHTML;
}
