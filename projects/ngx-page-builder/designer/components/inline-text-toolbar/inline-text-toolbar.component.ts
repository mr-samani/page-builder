import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FontOption } from '../../controls/typography-control/typography-model';
import { EMPTY_TOOLBAR_STATE, ToggleCommand, ToolbarState } from '../../helper/inline-text-formatter';
import { NgxInputColor } from 'ngx-kit/color-picker';

interface FontGroupView {
  label: string;
  items: FontOption[];
}

/**
 * نوار ابزار شناور ویرایش متن (فقط UI).
 *
 * - هیچ منطق قالب‌بندی‌ای ندارد؛ فقط state را نشان می‌دهد و رویدادها را emit می‌کند
 *   (منطق در InlineTextFormatter و هماهنگی در InlineEditTextDirective است).
 * - داخل iframe ی کَنوَس ساخته می‌شود، پس با ShadowDom ایزوله است تا CSS صفحه رویش اثر نگذارد.
 * - mousedown ی دکمه‌ها preventDefault می‌شود تا selection ی داخل متن از دست نرود.
 */
@Component({
  selector: 'pb-inline-text-toolbar',
  templateUrl: './inline-text-toolbar.component.html',
  styleUrls: ['./inline-text-toolbar.component.scss'],
  standalone: true,
  encapsulation: ViewEncapsulation.ShadowDom,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgxInputColor],
})
export class InlineTextToolbarComponent {
  readonly state = input<ToolbarState>(EMPTY_TOOLBAR_STATE);
  readonly fonts = input<FontOption[]>([]);
  /** روی خود <a> نمی‌شود لینک تو در تو ساخت */
  readonly allowLink = input(true);

  readonly format = output<ToggleCommand>();
  readonly setFamily = output<string>();
  readonly setSize = output<number>();
  readonly setTextColor = output<string>();
  /** hex → هایلایت؛ null → حذف */
  readonly setHighlight = output<string | null>();
  readonly applyLink = output<{ href: string; newTab: boolean }>();
  readonly removeLink = output<void>();
  readonly clearFormat = output<void>();
  readonly saveSelection = output<void>();
  readonly commit = output<void>();
  readonly cancel = output<void>();

  private readonly bar = viewChild.required<ElementRef<HTMLElement>>('bar');
  protected readonly transform = signal('translate(0px, 0px)');
  protected readonly visible = signal(true);

  protected readonly groups = computed<FontGroupView[]>(() => {
    const map = new Map<string, FontOption[]>();
    for (const f of this.fonts()) map.set(f.group, [...(map.get(f.group) ?? []), f]);
    return [...map].map(([label, items]) => ({ label, items }));
  });

  //---------------------------------- link row ----------------------------------

  protected readonly linkOpen = signal(false);
  protected readonly linkHref = signal('');
  protected readonly linkNewTab = signal(false);
  protected readonly linkInvalid = signal(false);

  protected toggleLink(): void {
    if (this.linkOpen()) return this.linkOpen.set(false);
    const s = this.state();
    this.linkHref.set(s.linkHref ?? '');
    this.linkNewTab.set(s.linkNewTab);
    this.linkInvalid.set(false);
    this.linkOpen.set(true);
    queueMicrotask(() => this.bar().nativeElement.querySelector<HTMLInputElement>('.href')?.focus());
  }

  protected submitLink(): void {
    const href = this.linkHref().trim();
    if (!href) return void this.linkInvalid.set(true);
    this.applyLink.emit({ href, newTab: this.linkNewTab() });
    this.linkOpen.set(false);
  }

  /** پدر اگر آدرس را نامعتبر دانست می‌تواند بازش کند */
  markLinkInvalid(): void {
    this.linkOpen.set(true);
    this.linkInvalid.set(true);
  }

  protected removeLinkClick(): void {
    this.removeLink.emit();
    this.linkOpen.set(false);
  }

  //---------------------------------- size / placement ----------------------------------

  protected submitSize(input: HTMLInputElement): void {
    const n = parseFloat(input.value);
    if (n > 0) this.setSize.emit(n);
  }

  /** بالای المنت (یا اگر جا نبود، زیرش) قرار می‌گیرد؛ مختصات نسبت به viewport ی iframe */
  place(anchor: DOMRect): void {
    const bar = this.bar().nativeElement;
    const win = bar.ownerDocument.defaultView;
    if (!win) return;
    const w = bar.offsetWidth;
    const h = bar.offsetHeight;
    this.visible.set(!(anchor.bottom < 0 || anchor.top > win.innerHeight));
    let top = anchor.top - h - 8;
    if (top < 4) top = Math.min(anchor.bottom + 8, win.innerHeight - h - 4);
    const left = Math.min(Math.max(4, anchor.left), Math.max(4, win.innerWidth - w - 4));
    this.transform.set(`translate(${Math.round(left)}px, ${Math.round(Math.max(4, top))}px)`);
  }
}
