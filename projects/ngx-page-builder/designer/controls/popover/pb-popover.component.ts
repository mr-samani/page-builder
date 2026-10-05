import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  NgZone,
  OnDestroy,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

/**
 * پاپ‌اوور سبک Webflow برای ویرایشگرهای کنترل‌ها (Transform / Transition).
 *
 * - از Popover API مرورگر استفاده می‌کند (top-layer)، پس هیچ‌وقت توسط overflow پنل کناری
 *   بریده نمی‌شود و به z-index و transform والدها وابسته نیست.
 * - کنار پنل راست (روی کَنوَس) باز می‌شود و داخل viewport می‌ماند.
 * - بسته شدن: کلیک بیرون، Esc، یا دکمه‌ی ✕. کلیک روی `dialog[open]` (مثل انتخاب متغیر CSS) بیرون حساب نمی‌شود.
 *
 * محتوای داخلش را فقط وقتی `isOpen()` است بسازید تا پنل‌های بسته هزینه‌ای نداشته باشند:
 * ```html
 * <pb-popover #pop heading="Move" (closed)="onClosed()">
 *   @if (pop.isOpen()) { ... }
 * </pb-popover>
 * ```
 */
@Component({
  selector: 'pb-popover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #root
      class="pb-popover"
      popover="manual"
      role="dialog"
      [attr.aria-label]="heading()"
      [style.width.px]="width()">
      <div class="pb-popover-head">
        <span class="pb-popover-title">{{ heading() }}</span>
        <span class="pb-popover-actions"><ng-content select="[popover-actions]"></ng-content></span>
        <button type="button" class="pb-popover-close" aria-label="Close" title="Close (Esc)" (click)="close()">
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </button>
      </div>
      <div class="pb-popover-body"><ng-content></ng-content></div>
    </div>
  `,
  styles: `
    :host {
      display: contents;
    }
    .pb-popover {
      position: fixed;
      inset: auto;
      margin: 0;
      padding: 0;
      border: 1px solid #4a4a52;
      border-radius: 8px;
      background: #1b1a1d;
      color: #e8e8ea;
      box-shadow:
        0 12px 32px rgba(0, 0, 0, 0.55),
        0 0 0 1px rgba(0, 0, 0, 0.4);
      direction: ltr;
      font:
        12px/1.4 system-ui,
        -apple-system,
        'Segoe UI',
        sans-serif;
      overflow: visible;
      max-height: calc(100vh - 16px);
      display: none;
      flex-direction: column;
    }
    .pb-popover:popover-open,
    .pb-popover.pb-popover-fallback {
      display: flex;
    }
    .pb-popover.pb-popover-fallback {
      z-index: 2147483000;
    }
    .pb-popover-head {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 8px 8px 12px;
      border-bottom: 1px solid #34343a;
      flex: none;
    }
    .pb-popover-title {
      font-weight: 600;
      letter-spacing: 0.01em;
      flex: 1;
    }
    .pb-popover-actions {
      display: inline-flex;
      gap: 4px;
      align-items: center;
    }
    .pb-popover-close {
      all: unset;
      box-sizing: border-box;
      width: 22px;
      height: 22px;
      display: inline-grid;
      place-items: center;
      border-radius: 4px;
      cursor: pointer;
      color: #a8a8b2;
    }
    .pb-popover-close:hover {
      background: #ffffff1a;
      color: #fff;
    }
    .pb-popover-close:focus-visible {
      outline: 2px solid #4b8bff;
    }
    .pb-popover-body {
      padding: 12px;
      overflow: auto;
      flex: 1;
      min-height: 0;
    }
  `,
})
export class PbPopoverComponent implements OnDestroy {
  heading = input<string>('');
  width = input<number>(300);
  /**
   * شناسه‌ی گروه: هر المانی با `data-pb-popover-group="<group>"` (مثلاً ردیف‌های لیست) «داخل» حساب می‌شود،
   * تا کلیک روی ردیف دیگر، پاپ‌اوور را ببندد و دوباره باز نکند (پرش بصری) و فقط جابه‌جایش کند.
   */
  group = input<string>('');
  /** هنگام بسته شدن (به هر دلیل) */
  closed = output<void>();

  isOpen = signal(false);

  private readonly root = viewChild.required<ElementRef<HTMLElement>>('root');
  private readonly doc = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private anchor?: HTMLElement;
  private resizeObserver?: ResizeObserver;
  private listening = false;

  /** `anchor` المانی است که پاپ‌اوور کنارش (سمت چپ پنل) باز می‌شود */
  open(anchor: HTMLElement): void {
    this.anchor = anchor;
    const el = this.root().nativeElement;
    this.isOpen.set(true);

    if (typeof (el as any).showPopover === 'function') {
      if (!el.matches(':popover-open')) (el as any).showPopover();
    } else {
      el.classList.add('pb-popover-fallback');
    }
    this.place();
    this.startListening();

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver?.disconnect();
      this.resizeObserver = new ResizeObserver(() => this.place());
      this.resizeObserver.observe(el);
    }
  }

  /** همان anchor را دوباره جابه‌جا/تغییر می‌دهد بدون بستن (مثلاً با انتخاب لایه‌ی دیگر) */
  moveTo(anchor: HTMLElement): void {
    this.anchor = anchor;
    if (this.isOpen()) this.place();
  }

  close(): void {
    if (!this.isOpen()) return;
    const el = this.root().nativeElement;
    this.stopListening();
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    try {
      if (typeof (el as any).hidePopover === 'function' && el.matches(':popover-open')) (el as any).hidePopover();
    } catch {
      /* already hidden */
    }
    el.classList.remove('pb-popover-fallback');
    this.isOpen.set(false);
    this.anchor = undefined;
    this.closed.emit();
  }

  ngOnDestroy(): void {
    this.stopListening();
    this.resizeObserver?.disconnect();
    try {
      const el = this.root().nativeElement;
      if (typeof (el as any).hidePopover === 'function' && el.matches(':popover-open')) (el as any).hidePopover();
    } catch {
      /* view already gone */
    }
  }

  //----------------------------------------------------------------------------------

  private place(): void {
    const el = this.root().nativeElement;
    const anchor = this.anchor;
    if (!anchor) return;

    const gap = 8;
    const a = anchor.getBoundingClientRect();
    // پنل تنظیمات کل ستون راست است؛ پاپ‌اوور را کنار خودِ پنل می‌گذاریم نه کنار ردیف
    const panel = (anchor.closest('.pb-inner') ?? anchor).getBoundingClientRect();
    const vw = this.doc.defaultView?.innerWidth ?? 1280;
    const vh = this.doc.defaultView?.innerHeight ?? 800;
    const w = el.offsetWidth || this.width();
    const h = el.offsetHeight;

    let left = panel.left - w - gap;
    if (left < gap) left = Math.min(panel.right + gap, vw - w - gap);
    left = Math.max(gap, left);

    let top = a.top - 12;
    top = Math.min(top, vh - h - gap);
    top = Math.max(gap, top);

    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
  }

  private onPointerDown = (ev: Event): void => {
    const t = ev.target as Node | null;
    const el = this.root().nativeElement;
    if (!t || el.contains(t)) return;
    if (this.anchor?.contains(t)) return; // کلیک روی خود ردیف را کنترل والد مدیریت می‌کند (toggle)
    const targetEl = t instanceof Element ? t : t.parentElement;
    const g = this.group();
    if (g && targetEl?.closest(`[data-pb-popover-group="${g}"]`)) return;
    // مودال‌های دیگر (انتخاب متغیر CSS و ...) در لایه‌ی بالاترند و «بیرون» حساب نمی‌شوند
    if (targetEl?.closest('dialog[open], [popover]:popover-open, .pb-no-dismiss')) return;
    this.zone.run(() => this.close());
  };

  private onKeyDown = (ev: KeyboardEvent): void => {
    if (ev.key !== 'Escape') return;
    // اگر مودال دیگری (انتخاب متغیر) باز است، Esc اول آن را می‌بندد
    if (this.doc.querySelector('dialog[open]')) return;
    ev.stopPropagation();
    this.zone.run(() => this.close());
  };

  /** اسکرول پنل کناری، anchor را جابه‌جا می‌کند؛ ساده‌ترین و قابل‌پیش‌بینی‌ترین رفتار: بستن */
  private onScroll = (ev: Event): void => {
    const t = ev.target as Node | null;
    if (t && this.root().nativeElement.contains(t)) return;
    this.zone.run(() => this.close());
  };

  private startListening(): void {
    if (this.listening) return;
    this.listening = true;
    // رویدادهای سنگین را بیرون از zone نگه می‌داریم؛ فقط close() داخل zone می‌رود
    this.zone.runOutsideAngular(() => {
      this.doc.addEventListener('pointerdown', this.onPointerDown, true);
      this.doc.addEventListener('keydown', this.onKeyDown, true);
      this.doc.addEventListener('scroll', this.onScroll, { capture: true, passive: true });
    });
  }

  private stopListening(): void {
    if (!this.listening) return;
    this.listening = false;
    this.doc.removeEventListener('pointerdown', this.onPointerDown, true);
    this.doc.removeEventListener('keydown', this.onKeyDown, true);
    this.doc.removeEventListener('scroll', this.onScroll, true);
  }
}
