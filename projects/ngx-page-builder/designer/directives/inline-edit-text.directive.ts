import {
  AfterViewInit,
  ApplicationRef,
  ComponentRef,
  Directive,
  DOCUMENT,
  EnvironmentInjector,
  Injector,
  Input,
  OnDestroy,
  createComponent,
  inject,
} from '@angular/core';
import { NgxDraggable } from 'ngx-kit/drag-resize';
import { LibConsts, PageItem } from 'ngx-page-builder/core';
import { InlineTextToolbarComponent } from '../components/inline-text-toolbar/inline-text-toolbar.component';
import { NGX_PAGE_BUILDER_FONTS } from '../controls/typography-control/fonts.token';
import { DEFAULT_FONTS, FontOption } from '../controls/typography-control/typography-model';
import { InlineTextFormatter } from '../helper/inline-text-formatter';
import { sanitizeInlineHtml } from '../helper/sanitize-inline-html';
import { HistoryService } from '../services/history.service';
import { PageBuilderService } from '../services/page-builder.service';

/**
 * ویرایش درجای متن بلاک (دوبار کلیک).
 *
 * این directive فقط «هماهنگ‌کننده» است:
 *  - چرخه‌ی ویرایش (شروع / ذخیره / انصراف / کلیک بیرون)           ← همین فایل
 *  - اعمال فرمت روی selection (فونت، رنگ، لینک، ...)               ← InlineTextFormatter
 *  - UI ی نوار ابزار                                                ← InlineTextToolbarComponent
 *  - پاک‌سازی HTML ی ذخیره‌شده و paste                              ← sanitizeInlineHtml
 *
 * پایان ویرایش: کلیک بیرون / Ctrl+Enter / ✓ → ذخیره؛  Esc / ✕ → انصراف.
 * Enter = شکست خط (<br>) تا div/p ی تو در تو ساخته نشود.
 *
 * نکته: directive ها در DynamicElementService دستی ساخته می‌شوند (نه با DI ی ویوی Angular)،
 * پس سرویس‌های وابسته را lazy و از طریق Injector می‌گیریم.
 */
@Directive({
  selector: '[InlineEditText]',
})
export class InlineEditTextDirective implements AfterViewInit, OnDestroy {
  @Input() pageItem!: PageItem;
  /** نوار ابزار قالب‌بندی را نشان بده؟ */
  @Input() toolbar = true;

  private readonly hostDoc = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly fonts: FontOption[] = [
    ...(inject(NGX_PAGE_BUILDER_FONTS, { optional: true }) ?? []),
    ...DEFAULT_FONTS.filter((f) => f.value !== 'inherit'),
  ];

  private el?: HTMLElement;
  private dragDir?: NgxDraggable;
  private editing = false;
  private startHtml = '';
  private saved: {
    contenteditable: string | null;
    spellcheck: string | null;
    draggable: string | null;
    userSelect: string;
  } | null = null;

  private fmt?: InlineTextFormatter;
  private bar?: { ref: ComponentRef<InlineTextToolbarComponent>; host: HTMLElement };
  private raf = 0;

  //---------------------------------- lifecycle ----------------------------------

  ngAfterViewInit(): void {
    this.el = this.pageItem?.el ?? undefined;
    this.el?.addEventListener('dblclick', this.onDblclick);
  }

  ngOnDestroy(): void {
    this.el?.removeEventListener('dblclick', this.onDblclick);
    // اگر وسط ویرایش حذف شدیم المنت دیگر وجود ندارد؛ فقط تمیزکاری
    if (this.editing) this.teardown();
  }

  get isEditing(): boolean {
    return this.editing;
  }

  private onDblclick = (): void => this.startEdit();

  //---------------------------------- start / stop ----------------------------------

  startEdit(): void {
    const el = this.el;
    if (!el || this.editing) return;
    const doc = el.ownerDocument;

    this.editing = true;
    this.startHtml = el.innerHTML;
    this.saved = {
      contenteditable: el.getAttribute('contenteditable'),
      spellcheck: el.getAttribute('spellcheck'),
      draggable: el.getAttribute('draggable'),
      userSelect: el.style.userSelect,
    };

    // درگ/ریسایز بلاک وقتی داخل متن انتخاب می‌کنیم نباید فعال شود
    this.dragDir ??= (el as any).__ngDirectives__?.find((x: any) => x instanceof NgxDraggable);
    this.dragDir?.disabled.set(true);
    el.removeAttribute('draggable');
    el.style.userSelect = 'text';
    el.setAttribute('spellcheck', 'false');
    el.contentEditable = 'true';
    el.focus({ preventScroll: true });

    this.fmt = new InlineTextFormatter(el, this.fonts);
    this.fmt.ensureCaret();

    el.addEventListener('keydown', this.onKeydown);
    el.addEventListener('paste', this.onPaste);
    el.addEventListener('click', this.onClick);
    for (const t of ['mousedown', 'pointerdown', 'touchstart'] as const) el.addEventListener(t, this.stop);
    doc.addEventListener('pointerdown', this.onOutside, true);
    doc.addEventListener('selectionchange', this.onSelectionChange);
    this.hostDoc.addEventListener('pointerdown', this.onHostPointerDown, true);

    if (this.toolbar) this.mountToolbar(doc);
  }

  /** @param save true → ذخیره؛ false → برگرداندن به متن قبل از ویرایش */
  stopEdit(save: boolean): void {
    const el = this.el;
    if (!el || !this.editing) return;

    if (!save) {
      el.innerHTML = this.startHtml;
      this.teardown();
      return;
    }

    const doc = el.ownerDocument;
    const before = this.startHtml;
    const cleaned = sanitizeInlineHtml(el.innerHTML, doc);
    this.teardown();

    if (cleaned === sanitizeInlineHtml(before, doc)) {
      // تغییر واقعی‌ای نبوده؛ DOM اولیه را (با همان مارک‌آپ قبلی) برگردان
      el.innerHTML = before;
      return;
    }
    el.innerHTML = cleaned;
    this.commit(cleaned);
  }

  private commit(content: string): void {
    const item = this.pageItem;
    const prevContent = item.content;
    item.content = content;
    try {
      this.injector.get(PageBuilderService).writeItemValue(item);
      if (LibConsts.enableHistory) {
        const prev = Object.assign(Object.create(Object.getPrototypeOf(item)), item, {
          content: prevContent,
        }) as PageItem;
        this.injector.get(HistoryService).saveEdit(item.id, item, prev, `Edit text '${item.id}'`);
      }
    } catch (e) {
      console.warn('InlineEditText: could not notify the page builder', e);
    }
  }

  private teardown(): void {
    const el = this.el;
    this.editing = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;

    if (el) {
      const doc = el.ownerDocument;
      el.removeEventListener('keydown', this.onKeydown);
      el.removeEventListener('paste', this.onPaste);
      el.removeEventListener('click', this.onClick);
      for (const t of ['mousedown', 'pointerdown', 'touchstart'] as const) el.removeEventListener(t, this.stop);
      doc.removeEventListener('pointerdown', this.onOutside, true);
      doc.removeEventListener('selectionchange', this.onSelectionChange);
      doc.defaultView?.removeEventListener('scroll', this.schedulePlace, true);
      doc.defaultView?.removeEventListener('resize', this.schedulePlace);

      const s = this.saved;
      if (s) {
        const restore = (name: string, v: string | null) =>
          v === null ? el.removeAttribute(name) : el.setAttribute(name, v);
        restore('contenteditable', s.contenteditable);
        restore('spellcheck', s.spellcheck);
        restore('draggable', s.draggable);
        el.style.userSelect = s.userSelect;
        if (!el.getAttribute('style')) el.removeAttribute('style');
      }
      doc.getSelection()?.removeAllRanges();
    }
    this.hostDoc.removeEventListener('pointerdown', this.onHostPointerDown, true);
    this.dragDir?.disabled.set(false);
    this.unmountToolbar();
    this.fmt = undefined;
    this.saved = null;
  }

  //---------------------------------- toolbar wiring ----------------------------------

  private mountToolbar(doc: Document): void {
    const fmt = this.fmt!;
    const host = doc.createElement('div');
    host.setAttribute('data-pb-inline-toolbar', '');
    doc.body.appendChild(host);

    const ref = createComponent(InlineTextToolbarComponent, {
      environmentInjector: this.injector.get(EnvironmentInjector),
      hostElement: host,
    });
    this.injector.get(ApplicationRef).attachView(ref.hostView);
    this.bar = { ref, host };

    ref.setInput('fonts', this.fonts);
    ref.setInput('allowLink', this.el!.tagName !== 'A');

    // هر فرمان: اعمال روی selection → بازخوانی state ی نوار ابزار
    const act =
      <T extends unknown[]>(fn: (...a: T) => void) =>
      (...a: T) => {
        fn(...a);
        this.refreshToolbar();
      };
    const c = ref.instance;
    c.format.subscribe(act((cmd) => fmt.toggle(cmd)));
    c.setFamily.subscribe(act((v) => fmt.fontFamily(v)));
    c.setSize.subscribe(act((px) => fmt.fontSize(px)));
    c.setTextColor.subscribe(act((hex) => fmt.textColor(hex)));
    c.setHighlight.subscribe(act((hex) => fmt.highlight(hex)));
    c.applyLink.subscribe(
      act(({ href, newTab }) => {
        if (!fmt.link(href, newTab)) c.markLinkInvalid();
      }),
    );
    c.removeLink.subscribe(act(() => fmt.unlink()));
    c.clearFormat.subscribe(act(() => fmt.clear()));
    c.saveSelection.subscribe(() => fmt.saveSelection());
    c.commit.subscribe(() => this.stopEdit(true));
    c.cancel.subscribe(() => this.stopEdit(false));

    const win = doc.defaultView;
    win?.addEventListener('scroll', this.schedulePlace, true);
    win?.addEventListener('resize', this.schedulePlace);
    this.refreshToolbar();
    this.schedulePlace();
  }

  private unmountToolbar(): void {
    if (!this.bar) return;
    this.injector.get(ApplicationRef).detachView(this.bar.ref.hostView);
    this.bar.ref.destroy();
    this.bar.host.remove();
    this.bar = undefined;
  }

  private refreshToolbar(): void {
    if (!this.bar || !this.fmt) return;
    this.bar.ref.setInput('state', this.fmt.readState());
    this.bar.ref.changeDetectorRef.detectChanges();
    this.schedulePlace();
  }

  private schedulePlace = (): void => {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      if (this.editing && this.el && this.bar) this.bar.ref.instance.place(this.el.getBoundingClientRect());
    });
  };

  //---------------------------------- element events ----------------------------------

  private stop = (ev: Event): void => ev.stopPropagation();

  private onClick = (ev: Event): void => {
    // لینک داخل متن حین ویرایش نباید صفحه را عوض کند
    if ((ev.target as HTMLElement | null)?.closest?.('a')) ev.preventDefault();
  };

  /** کلیک بیرون از المنت و نوار ابزار، داخل iframe */
  private onOutside = (ev: Event): void => {
    const path = ev.composedPath();
    if (path.includes(this.el!) || (this.bar && path.includes(this.bar.host))) return;
    this.stopEdit(true);
  };

  /** کلیک بیرون از iframe (پنل‌های ادیتور) */
  private onHostPointerDown(ev: Event) {
    const tagPaths = ev.composedPath().map((m: any) => m.tagName);
    if (tagPaths.includes('NGX-INPUT-COLOR')) return;
    this.stopEdit(true);
  }

  private onSelectionChange = (): void => {
    this.fmt?.saveSelection();
    this.refreshToolbar();
  };

  private onKeydown = (ev: KeyboardEvent): void => {
    // کلیدها نباید به shortcut های ادیتور (Delete بلاک، Ctrl+Z صفحه، ...) برسند
    ev.stopPropagation();

    if (ev.key === 'Escape') {
      ev.preventDefault();
      this.stopEdit(false);
    } else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault();
      this.stopEdit(true);
    } else if (ev.key === 'Enter' && !ev.isComposing) {
      // به‌جای <div>/<p> ی تو در تو، فقط شکست خط
      ev.preventDefault();
      this.el!.ownerDocument.execCommand('insertLineBreak');
    }
  };

  private onPaste = (ev: ClipboardEvent): void => {
    const doc = this.el!.ownerDocument;
    const data = ev.clipboardData;
    if (!data) return;
    ev.preventDefault();
    const clean = sanitizeInlineHtml(data.getData('text/html'), doc);
    if (clean) doc.execCommand('insertHTML', false, clean);
    else doc.execCommand('insertText', false, data.getData('text/plain'));
  };
}
