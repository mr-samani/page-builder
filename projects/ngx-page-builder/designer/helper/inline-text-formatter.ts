import { FontOption, findFont } from '../controls/typography-control/typography-model';
import { safeUrl } from './sanitize-inline-html';

export type ToggleCommand = 'bold' | 'italic' | 'underline' | 'strikeThrough' | 'subscript' | 'superscript';

/** وضعیت selection فعلی که نوار ابزار نمایش می‌دهد */
export interface ToolbarState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  sub: boolean;
  sup: boolean;
  fontFamily: string;
  fontSize: number;
  color: string;
  background: string;
  hasBackground: boolean;
  /** داخل لینک هستیم؟ */
  linkHref: string | null;
  linkNewTab: boolean;
}

export const EMPTY_TOOLBAR_STATE: ToolbarState = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  sub: false,
  sup: false,
  fontFamily: '',
  fontSize: 16,
  color: '#000000',
  background: '#ffff00',
  hasBackground: false,
  linkHref: null,
  linkNewTab: false,
};

export function rgbToHex(c: string): string | null {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(c);
  if (!m) return null;
  return '#' + [m[1], m[2], m[3]].map((n) => Math.min(255, +n).toString(16).padStart(2, '0')).join('');
}

/** `example.com` → `https://example.com`؛ پروتکل ناامن (javascript:) → '' */
export function normalizeHref(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  if (/^(?:[a-z][a-z0-9+.-]*:|#|\/|\.{1,2}\/|\?)/i.test(v)) return safeUrl(v);
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;
  return safeUrl(`https://${v}`);
}

/**
 * موتور قالب‌بندی روی یک المنت contentEditable (بدون هیچ UI).
 *
 * selection را نگه می‌دارد چون با رفتن فوکوس به نوار ابزار (select، input رنگ، فیلد لینک) از دست می‌رود،
 * و هر فرمان را روی selection ی ذخیره‌شده اجرا می‌کند.
 * اگر چیزی انتخاب نشده باشد، فرمان‌های «ظاهری» (فونت، اندازه، رنگ، لینک) روی کل متن المنت اعمال می‌شوند.
 */
export class InlineTextFormatter {
  private lastRange: Range | null = null;

  constructor(
    private readonly el: HTMLElement,
    private readonly fonts: FontOption[],
  ) {}

  private get doc(): Document {
    return this.el.ownerDocument;
  }

  //---------------------------------- selection ----------------------------------

  /** هنگام شروع ویرایش: اگر selection داخل المنت نیست، caret را آخر متن بگذار */
  ensureCaret(): void {
    const sel = this.doc.getSelection();
    if (sel && (!sel.rangeCount || !this.el.contains(sel.anchorNode))) {
      const r = this.doc.createRange();
      r.selectNodeContents(this.el);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
    }
    this.saveSelection();
  }

  saveSelection(): void {
    const sel = this.doc.getSelection();
    if (!sel?.rangeCount) return;
    if (this.el.contains(sel.anchorNode) && this.el.contains(sel.focusNode)) this.lastRange = sel.getRangeAt(0).cloneRange();
  }

  private restoreSelection(): Selection | null {
    this.el.focus({ preventScroll: true });
    const sel = this.doc.getSelection();
    if (!sel) return null;
    const r = this.lastRange && this.el.contains(this.lastRange.commonAncestorContainer) ? this.lastRange : null;
    if (r) {
      sel.removeAllRanges();
      sel.addRange(r);
    } else if (!sel.rangeCount || !this.el.contains(sel.anchorNode)) {
      const end = this.doc.createRange();
      end.selectNodeContents(this.el);
      end.collapse(false);
      sel.removeAllRanges();
      sel.addRange(end);
    }
    return sel;
  }

  private run(fn: () => void, wholeIfCollapsed: boolean): void {
    const sel = this.restoreSelection();
    if (sel && wholeIfCollapsed && sel.isCollapsed) {
      const all = this.doc.createRange();
      all.selectNodeContents(this.el);
      sel.removeAllRanges();
      sel.addRange(all);
    }
    fn();
    this.saveSelection();
  }

  private exec(cmd: string, value?: string): void {
    this.doc.execCommand(cmd, false, value);
  }
  private css(on: boolean): void {
    this.exec('styleWithCSS', on ? 'true' : 'false');
  }

  //---------------------------------- commands ----------------------------------

  /** B / I / U / S / x₂ / x²  (بدون selection روی متنی که بعداً تایپ می‌شود اثر می‌کند) */
  toggle(cmd: ToggleCommand): void {
    this.run(() => {
      this.css(false);
      this.exec(cmd);
    }, false);
  }

  fontFamily(value: string): void {
    if (!value) return;
    this.run(() => {
      this.css(true);
      this.exec('fontName', value);
    }, true);
  }

  /** execCommand ی fontSize فقط ۱ تا ۷ را می‌فهمد؛ ۷ را می‌زنیم و بعد با اندازه‌ی px ی واقعی جایگزین می‌کنیم */
  fontSize(px: number): void {
    if (!Number.isFinite(px) || px < 1 || px > 400) return;
    const MARK = 'font[size="7"], [style*="xxx-large"]';
    this.run(() => {
      const existing = new Set(Array.from(this.el.querySelectorAll<HTMLElement>(MARK)));
      this.css(true);
      this.exec('fontSize', '7');
      for (const n of Array.from(this.el.querySelectorAll<HTMLElement>(MARK))) {
        if (existing.has(n)) continue;
        let target = n;
        if (n.tagName === 'FONT') {
          target = this.doc.createElement('span');
          while (n.firstChild) target.appendChild(n.firstChild);
          n.replaceWith(target);
        }
        target.style.fontSize = `${px}px`;
        // اندازه‌ی لایه‌های داخلی قبلی نباید اندازه‌ی جدید را لغو کند
        target.querySelectorAll<HTMLElement>('[style*="font-size"]').forEach((c) => c.style.removeProperty('font-size'));
      }
    }, true);
  }

  textColor(hex: string): void {
    this.run(() => {
      this.css(true);
      this.exec('foreColor', hex);
    }, true);
  }

  /** hex → هایلایت؛ null → حذف هایلایت */
  highlight(hex: string | null): void {
    this.run(() => {
      this.css(true);
      this.exec('hiliteColor', hex ?? 'transparent');
    }, true);
  }

  /** @returns false اگر آدرس نامعتبر/ناامن بود */
  link(href: string, newTab: boolean): boolean {
    const url = normalizeHref(href);
    if (!url) return false;
    this.run(() => {
      this.exec('createLink', url);
      const sel = this.doc.getSelection();
      const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
      this.el.querySelectorAll<HTMLAnchorElement>('a').forEach((a) => {
        if (range && !range.intersectsNode(a)) return;
        if (newTab) {
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
        } else {
          a.removeAttribute('target');
          a.removeAttribute('rel');
        }
      });
    }, true);
    return true;
  }

  unlink(): void {
    this.run(() => this.exec('unlink'), false);
  }

  clear(): void {
    this.run(() => {
      this.exec('removeFormat');
      this.exec('unlink');
      // با styleWithCSS ممکن است span های style دار باقی بمانند
      const sel = this.doc.getSelection();
      const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
      this.el.querySelectorAll<HTMLElement>('span[style]').forEach((s) => {
        if (range && !range.intersectsNode(s)) return;
        s.removeAttribute('style');
      });
    }, true);
  }

  //---------------------------------- state ----------------------------------

  private currentAnchor(): HTMLAnchorElement | null {
    const node = this.lastRange?.commonAncestorContainer ?? this.doc.getSelection()?.anchorNode ?? null;
    const a = (node?.nodeType === 1 ? (node as HTMLElement) : node?.parentElement)?.closest('a') ?? null;
    return a && this.el.contains(a) ? a : null;
  }

  readState(): ToolbarState {
    const win = this.doc.defaultView!;
    const sel = this.doc.getSelection();
    const inside = !!sel?.rangeCount && this.el.contains(sel.anchorNode);
    const base: Node = inside ? sel!.anchorNode! : (this.lastRange?.startContainer ?? this.el);
    const node = (base.nodeType === 1 ? (base as HTMLElement) : base.parentElement) ?? this.el;
    const cs = win.getComputedStyle(node);

    // نزدیک‌ترین پس‌زمینه‌ی (هایلایت) واقعی بین نقطه‌ی انتخاب و خود المنت
    let bg = '';
    for (let n: HTMLElement | null = node; n && n !== this.el && this.el.contains(n); n = n.parentElement) {
      const c = win.getComputedStyle(n).backgroundColor;
      if (c && c !== 'transparent' && !/,\s*0\)$/.test(c)) {
        bg = c;
        break;
      }
    }

    const is = (cmd: string) => {
      try {
        return this.doc.queryCommandState(cmd);
      } catch {
        return false;
      }
    };
    const a = this.currentAnchor();
    return {
      bold: is('bold'),
      italic: is('italic'),
      underline: is('underline'),
      strike: is('strikeThrough'),
      sub: is('subscript'),
      sup: is('superscript'),
      fontFamily: findFont(this.fonts, cs.fontFamily)?.value ?? '',
      fontSize: Math.round(parseFloat(cs.fontSize) * 10) / 10,
      color: rgbToHex(cs.color) ?? '#000000',
      background: (bg && rgbToHex(bg)) || '#ffff00',
      hasBackground: !!bg,
      linkHref: a ? (a.getAttribute('href') ?? '') : null,
      linkNewTab: a?.target === '_blank',
    };
  }
}
