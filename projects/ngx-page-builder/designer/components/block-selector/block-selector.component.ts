import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  NgZone,
  OnDestroy,
  untracked,
  ViewChild,
} from '@angular/core';
import { BaseComponent } from '../BaseComponent';
import { PageItem } from 'ngx-page-builder/core';
import { NgxIconComponent } from 'ngx-page-builder/icons';

const BAR_HEIGHT = 24;
const PLACEMENTS = ['top', 'bottom', 'inside'] as const;

// ایندکس‌های آرایه‌ی اندازه‌گیری
const X = 0,
  Y = 1,
  W = 2,
  H = 3;
const MARGIN = 4; // t r b l  -> 4..7 (ترتیب: top, right, bottom, left)
const BORDER = 8; // 8..11
const PADDING = 12; // 12..15
const SHIFT_X = 16,
  SHIFT_Y = 17,
  PLACE = 18;
const SIZE = 19;

const px = (v: string) => Math.max(0, parseFloat(v) || 0);
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

@Component({
  selector: 'block-selector',
  templateUrl: './block-selector.component.html',
  styleUrls: ['./block-selector.component.scss'],
  standalone: true,
  imports: [CommonModule, NgxIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockSelectorComponent extends BaseComponent implements OnDestroy {
  item?: PageItem | null;
  headerOffset = 30;

  @ViewChild('frame', { static: true }) private frameRef!: ElementRef<HTMLElement>;
  @ViewChild('margin', { static: true }) private marginRef!: ElementRef<HTMLElement>;
  @ViewChild('padding', { static: true }) private paddingRef!: ElementRef<HTMLElement>;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);

  private rafId?: number;
  private prev = new Float64Array(SIZE);
  private next = new Float64Array(SIZE);
  private prevRadius = '';
  private visible = false;

  constructor() {
    super();

    effect(() => {
      const active = this.pb.activeEl();
      untracked(() => this.setItem(active));
    });

    // this.pb.changed$.pipe(takeUntilDestroyed()).subscribe((data) => this.setItem(data.item));
  }

  ngOnDestroy() {
    this.stop();
  }

  /* ------------------------------------------------------------------ */
  /*  مدیریت آیتم                                                         */
  /* ------------------------------------------------------------------ */

  private setItem(item: PageItem | null | undefined) {
    const next = item ?? null;
    if (this.item === next) return;

    this.item = next;
    this.chdRef.markForCheck();

    if (next?.el) {
      this.measure(true);
      this.start();
    } else {
      this.stop();
      this.setVisible(false);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  حلقه‌ی rAF (بیرون از zone)                                          */
  /* ------------------------------------------------------------------ */

  private start() {
    if (this.rafId !== undefined) return;
    this.zone.runOutsideAngular(() => {
      const tick = () => {
        this.rafId = requestAnimationFrame(tick);
        this.measure();
      };
      this.rafId = requestAnimationFrame(tick);
    });
  }

  private stop() {
    if (this.rafId !== undefined) {
      cancelAnimationFrame(this.rafId);
      this.rafId = undefined;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  اندازه‌گیری                                                         */
  /* ------------------------------------------------------------------ */

  private measure(force = false) {
    const el = this.item?.el;
    if (!el || !el.isConnected) {
      this.setVisible(false);
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      this.setVisible(false);
      return;
    }

    const win = el.ownerDocument.defaultView;
    if (!win) return;

    // مبدأ مختصات خود host (که صفر در صفر است)؛ این روش scroll/RTL/transform پدر را خودکار حل می‌کند
    const origin = this.host.nativeElement.getBoundingClientRect();
    const cs = win.getComputedStyle(el);
    const n = this.next;

    n[X] = rect.left - origin.left;
    n[Y] = rect.top - origin.top;
    n[W] = rect.width;
    n[H] = rect.height;

    n[MARGIN] = px(cs.marginTop);
    n[MARGIN + 1] = px(cs.marginRight);
    n[MARGIN + 2] = px(cs.marginBottom);
    n[MARGIN + 3] = px(cs.marginLeft);

    n[BORDER] = px(cs.borderTopWidth);
    n[BORDER + 1] = px(cs.borderRightWidth);
    n[BORDER + 2] = px(cs.borderBottomWidth);
    n[BORDER + 3] = px(cs.borderLeftWidth);

    n[PADDING] = px(cs.paddingTop);
    n[PADDING + 1] = px(cs.paddingRight);
    n[PADDING + 2] = px(cs.paddingBottom);
    n[PADDING + 3] = px(cs.paddingLeft);

    // جای نوار اکشن: بالا | پایین | داخل بلاک (وقتی بلاک خیلی بلند است)
    let placement = 0;
    let shiftY = 0;
    if (rect.top - BAR_HEIGHT < this.headerOffset) {
      if (rect.bottom + BAR_HEIGHT <= win.innerHeight) {
        placement = 1;
      } else {
        placement = 2;
        shiftY = clamp(this.headerOffset - rect.top, 0, Math.max(0, rect.height - BAR_HEIGHT));
      }
    }
    n[PLACE] = placement;
    n[SHIFT_Y] = shiftY;
    n[SHIFT_X] = clamp(-rect.left, 0, Math.max(0, rect.width - BAR_HEIGHT));

    const radius = cs.borderRadius;

    if (!force && this.visible && radius === this.prevRadius && this.same()) return;

    this.prev.set(n);
    this.prevRadius = radius;
    this.apply(radius);
  }

  private same(): boolean {
    for (let i = 0; i < SIZE; i++) {
      if (this.prev[i] !== this.next[i]) return false;
    }
    return true;
  }

  /* ------------------------------------------------------------------ */
  /*  نوشتن مستقیم روی DOM (بدون Change Detection)                         */
  /* ------------------------------------------------------------------ */

  private apply(radius: string) {
    const n = this.next;
    const frame = this.frameRef.nativeElement;
    const margin = this.marginRef.nativeElement;
    const padding = this.paddingRef.nativeElement;

    this.visible = true;

    // قاب اصلی
    frame.style.display = 'block';
    frame.style.transform = `translate3d(${n[X]}px, ${n[Y]}px, 0)`;
    frame.style.width = `${n[W]}px`;
    frame.style.height = `${n[H]}px`;
    frame.style.borderRadius = radius;
    frame.dataset['placement'] = PLACEMENTS[n[PLACE]];
    frame.style.setProperty('--shift-x', `${n[SHIFT_X]}px`);
    frame.style.setProperty('--shift-y', `${n[SHIFT_Y]}px`);

    // margin  (هاشور نارنجی)
    const [mt, mr, mb, ml] = [n[MARGIN], n[MARGIN + 1], n[MARGIN + 2], n[MARGIN + 3]];
    if (mt || mr || mb || ml) {
      margin.style.display = 'block';
      margin.style.transform = `translate3d(${n[X] - ml}px, ${n[Y] - mt}px, 0)`;
      margin.style.width = `${n[W] + ml + mr}px`;
      margin.style.height = `${n[H] + mt + mb}px`;
      margin.style.padding = `${mt}px ${mr}px ${mb}px ${ml}px`;
    } else {
      margin.style.display = 'none';
    }

    // padding  (هاشور سبز)
    const [pt, pr, pb, pl] = [n[PADDING], n[PADDING + 1], n[PADDING + 2], n[PADDING + 3]];
    if (pt || pr || pb || pl) {
      padding.style.display = 'block';
      padding.style.transform = `translate3d(${n[X]}px, ${n[Y]}px, 0)`;
      padding.style.width = `${n[W]}px`;
      padding.style.height = `${n[H]}px`;
      padding.style.borderWidth = `${n[BORDER]}px ${n[BORDER + 1]}px ${n[BORDER + 2]}px ${n[BORDER + 3]}px`;
      padding.style.padding = `${pt}px ${pr}px ${pb}px ${pl}px`;
    } else {
      padding.style.display = 'none';
    }
  }

  private setVisible(value: boolean) {
    if (value === this.visible && value) return;
    this.visible = value;
    if (!value) {
      this.frameRef.nativeElement.style.display = 'none';
      this.marginRef.nativeElement.style.display = 'none';
      this.paddingRef.nativeElement.style.display = 'none';
    }
  }

  /* ------------------------------------------------------------------ */
  /*  اکشن‌ها                                                             */
  /* ------------------------------------------------------------------ */

  async deleteBlock() {
    if (this.item && !this.item.disableDelete) {
      await this.pb.removeBlock(this.item);
    }
  }

  selectParent(ev: PointerEvent) {
    if (this.item?.parent) {
      this.pb.selectBlock(this.item.parent, ev);
    }
  }
}
