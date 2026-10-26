import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgxDraggable, NgxDropList, NgxDropListGroup, type IDropEvent } from 'ngx-kit/drag-resize';
import { Notify } from 'ngx-kit/notify';
import { PageItem } from 'ngx-page-builder/core';
import { auditTime, merge } from 'rxjs';
import { SvgIconDirective } from '../../directives/svg-icon.directive';
import { MoveTarget, PageZone } from '../../services/page-builder.service';
import { PageBuilderBaseComponent } from '../page-builder-base-component';

export type MoveDirection = 'up' | 'down' | 'out' | 'in';

interface MovePlan {
  target: MoveTarget;
  /** موقعیت نهایی در لیست مقصد */
  index: number;
}

const NO_ITEMS: PageItem[] = [];

/**
 * درخت همه‌ی بلاک‌های صفحه؛ انتخاب بلاک و جابجایی آن‌ها (درگ، دکمه‌های ↑ ↓ ← →، یا کیبورد).
 *
 * - لیست‌ها همان آرایه‌های واقعی صفحه هستند (نه کپی)، پس هر تغییر مستقیم دیده می‌شود.
 * - منطق جابجایی (المنت، CSS، history، رویدادها) فقط در PageBuilderService.moveBlock است؛
 *   این کامپوننت فقط UI و اعتبارسنجی مقصد است.
 * - وضعیت باز/بسته‌ی گره‌ها داخل خود کامپوننت نگه داشته می‌شود (نه روی PageItem) تا در ذخیره و history نشت نکند.
 */
@Component({
  selector: 'block-layouts',
  templateUrl: './block-layouts.component.html',
  styleUrls: ['./block-layouts.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, SvgIconDirective, NgxDropListGroup, NgxDraggable, NgxDropList],
})
export class BlockLayoutsComponent extends PageBuilderBaseComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  /** شناسه‌ی گره‌های باز */
  protected readonly expanded = signal<ReadonlySet<string>>(new Set());

  constructor() {
    super();

    // انتخاب از روی کَنوَس (یا هرجای دیگر) → مسیر تا بلاک باز شود و در دید بیاید
    effect(() => {
      const active = this.pb.activeEl();
      if (!active) return;
      untracked(() => this.revealItem(active));
    });

    // تغییر صفحه / undo / redo / افزودن، حذف، جابجایی یا تغییر نام تگ → بازرسم
    merge(this.pb.onPageChange$, this.pb.changed$)
      .pipe(auditTime(40), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.chdRef.markForCheck());
  }

  //---------------------------------- data ----------------------------------

  protected get header(): PageItem[] {
    return this.pb.currentPage?.headerItems ?? NO_ITEMS;
  }
  protected get body(): PageItem[] {
    return this.pb.currentPage?.bodyItems ?? NO_ITEMS;
  }
  protected get footer(): PageItem[] {
    return this.pb.currentPage?.footerItems ?? NO_ITEMS;
  }

  /** نام نمایشی + اطلاعات کمکی برای پیدا کردن بلاک (کلاس یا شروع متن) */
  protected describe(item: PageItem): { name: string; hint: string } {
    const name = item.tag || item.el?.tagName.toLowerCase() || 'block';
    const cls = item.classList?.find((c) => c && !c.startsWith('block-item'));
    if (cls) return { name, hint: `.${cls}` };
    const text = (item.content ?? '').slice(0, 160).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return { name, hint: text.length > 26 ? `${text.slice(0, 26)}…` : text };
  }

  protected canNest(item: PageItem): boolean {
    return !!item.canHaveChild && !item.customComponent;
  }

  //---------------------------------- expand / collapse ----------------------------------

  protected isOpen(item: PageItem): boolean {
    return this.expanded().has(item.id);
  }

  protected toggle(ev: Event, item: PageItem): void {
    ev.stopPropagation();
    this.setOpen(item, !this.isOpen(item));
  }

  private setOpen(item: PageItem, open: boolean): void {
    this.expanded.update((s) => {
      const next = new Set(s);
      open ? next.add(item.id) : next.delete(item.id);
      return next;
    });
  }

  expandAll(): void {
    const ids = new Set<string>();
    const walk = (list: PageItem[]) =>
      list.forEach((i) => {
        if (this.canNest(i)) ids.add(i.id);
        walk(i.children ?? []);
      });
    walk(this.header);
    walk(this.body);
    walk(this.footer);
    this.expanded.set(ids);
  }

  collapseAll(): void {
    this.expanded.set(new Set());
  }

  /** همه‌ی پدرهای بلاک را باز می‌کند و ردیفش را در دید می‌آورد */
  private revealItem(item: PageItem): void {
    const open: string[] = [];
    for (let p = item.parent; p; p = p.parent) open.push(p.id);
    if (open.some((id) => !this.expanded().has(id))) {
      this.expanded.update((s) => new Set([...s, ...open]));
    }
    this.chdRef.markForCheck();
    setTimeout(() => this.rowOf(item.id)?.scrollIntoView({ block: 'nearest' }), 0);
  }

  //---------------------------------- select ----------------------------------

  protected select(ev: Event, item: PageItem): void {
    this.pb.selectBlock(item, ev instanceof PointerEvent ? ev : undefined);
    if (!(ev instanceof PointerEvent)) ev.stopPropagation();
  }

  //---------------------------------- drag & drop ----------------------------------

  protected async onDrop(ev: IDropEvent<PageItem[]>, parent: PageItem | undefined, zone: PageZone): Promise<void> {
    const item = ev.previousContainer.data?.[ev.previousIndex];
    if (!item || !ev.container.data) return;
    if (ev.previousContainer.el === ev.container.el && ev.previousIndex === ev.currentIndex) return;
    await this.move(item, { parent, zone }, ev.currentIndex);
  }

  //---------------------------------- move buttons / keyboard ----------------------------------

  /** برنامه‌ی جابجایی برای یک جهت؛ null اگر ممکن نیست */
  private plan(item: PageItem, dir: MoveDirection): MovePlan | null {
    const zone = this.pb.getItemZone(item);
    if (!zone) return null;
    const parent = item.parent;
    const list = parent?.children ?? this.pb.getZoneList(zone) ?? NO_ITEMS;
    const i = list.indexOf(item);
    if (i < 0) return null;

    let plan: MovePlan | null = null;
    switch (dir) {
      case 'up':
        if (i > 0) plan = { target: { parent, zone }, index: i - 1 };
        break;
      case 'down':
        if (i < list.length - 1) plan = { target: { parent, zone }, index: i + 1 };
        break;
      case 'out': {
        // یک سطح بالاتر، درست بعد از پدر فعلی
        if (!parent) break;
        const grand = parent.parent;
        const grandList = grand?.children ?? this.pb.getZoneList(zone) ?? NO_ITEMS;
        const pi = grandList.indexOf(parent);
        if (pi >= 0) plan = { target: { parent: grand, zone }, index: pi + 1 };
        break;
      }
      case 'in': {
        // داخل برادر قبلی (انتهای فرزندانش)
        const prev = list[i - 1];
        if (prev && this.canNest(prev)) plan = { target: { parent: prev, zone }, index: prev.children.length };
        break;
      }
    }
    return plan && this.pb.checkMove(item, plan.target) === null ? plan : null;
  }

  protected canMove(item: PageItem, dir: MoveDirection): boolean {
    return !item.disableMovement && this.plan(item, dir) !== null;
  }

  protected async moveBy(ev: Event, item: PageItem, dir: MoveDirection): Promise<void> {
    ev.stopPropagation();
    const plan = this.plan(item, dir);
    if (plan) await this.move(item, plan.target, plan.index);
  }

  private async move(item: PageItem, target: MoveTarget, index: number): Promise<void> {
    const reason = this.pb.checkMove(item, target);
    if (reason) {
      Notify.warning(reason);
      return;
    }
    const moved = await this.pb.moveBlock(item, target, index);
    if (moved && target.parent) this.setOpen(target.parent, true);
    this.chdRef.markForCheck();
    if (moved) setTimeout(() => this.rowOf(item.id)?.focus({ preventScroll: true }), 0);
  }

  //---------------------------------- keyboard ----------------------------------

  protected onKeydown(ev: KeyboardEvent, item: PageItem): void {
    // وقتی داخل دکمه‌های همین ردیف هستیم، کلیدهای خودشان را داشته باشند
    if ((ev.target as HTMLElement).closest('button') && (ev.key === 'Enter' || ev.key === ' ')) return;

    if (ev.altKey) {
      const dir = ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'out', ArrowRight: 'in' } as Record<string, MoveDirection>)[ev.key];
      if (dir) {
        ev.preventDefault();
        void this.moveBy(ev, item, dir);
      }
      return;
    }

    switch (ev.key) {
      case 'Enter':
      case ' ':
        ev.preventDefault();
        this.select(ev, item);
        break;
      case 'ArrowDown':
      case 'ArrowUp': {
        ev.preventDefault();
        const rows = this.rows();
        const i = rows.findIndex((r) => r === ev.currentTarget);
        rows[i + (ev.key === 'ArrowDown' ? 1 : -1)]?.focus();
        break;
      }
      case 'ArrowRight':
        ev.preventDefault();
        if (this.canNest(item) && !this.isOpen(item)) this.setOpen(item, true);
        else if (this.isOpen(item)) this.rowOf(item.children[0]?.id)?.focus();
        break;
      case 'ArrowLeft':
        ev.preventDefault();
        if (this.isOpen(item)) this.setOpen(item, false);
        else if (item.parent) this.rowOf(item.parent.id)?.focus();
        break;
    }
  }

  private rows(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.row'));
  }

  private rowOf(id?: string): HTMLElement | undefined {
    if (!id) return undefined;
    return this.rows().find((r) => r.dataset['id'] === id);
  }
}
