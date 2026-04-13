import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, HostListener, Injector, OnDestroy } from '@angular/core';
import { BaseComponent } from '../BaseComponent';
import { SvgIconDirective } from '../../directives/svg-icon.directive';
import { PageItem } from 'ngx-page-builder/core';

@Component({
  selector: 'block-selector',
  templateUrl: './block-selector.component.html',
  styleUrls: ['./block-selector.component.scss'],
  standalone: true,
  imports: [CommonModule, SvgIconDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockSelectorComponent extends BaseComponent implements OnDestroy {
  x = 0;
  y = 0;
  width = 0;
  height = 0;
  item?: PageItem | null;
  showInBottom = false;
  headerOffset = 30;

  // Observer روی خود element: سایز
  private elementResizeObserver?: ResizeObserver;
  // Observer روی parent: جابجایی layout (flex/grid/...)
  private parentResizeObserver?: ResizeObserver;
  // Observer روی element: تغییر محتوا داخل (text، child nodes)
  private contentMutationObserver?: MutationObserver;
  // Observer روی خود element: تغییر style/class خودش
  private attributeMutationObserver?: MutationObserver;

  private rafId?: number;

  constructor(injector: Injector) {
    super(injector);

    effect(() => {
      const newItem = this.pb.activeEl();
      this.item = newItem;
      this.observeActiveElement();
    });

    this.pb.changed$.subscribe((data) => {
      this.item = data.item;
      this.observeActiveElement();
      this.scheduleUpdate();
    });
  }

  @HostListener('window:resize')
  onPageResize() {
    this.scheduleUpdate();
  }

  ngOnDestroy() {
    this.disconnectObservers();
    this.cancelScheduledUpdate();
  }

  private observeActiveElement() {
    this.disconnectObservers();

    if (!this.item?.el) {
      this.chdRef.detectChanges();
      return;
    }

    const el = this.item.el;

    // 1) سایز خود element
    this.elementResizeObserver = new ResizeObserver(() => this.scheduleUpdate());
    this.elementResizeObserver.observe(el);

    // 2) تغییر layout پدر (flex، grid، margin، padding پدر)
    //    فقط یک سطح بالاتر کافیه چون getBoundingClientRect نسبت به viewport هست
    if (el.parentElement) {
      this.parentResizeObserver = new ResizeObserver(() => this.scheduleUpdate());
      this.parentResizeObserver.observe(el.parentElement);
    }

    // 3) تغییر محتوا داخل element (text تایپ، child اضافه/حذف شد)
    //    subtree: true یعنی هر تغییری در هر سطحی از داخل
    this.contentMutationObserver = new MutationObserver(() => this.scheduleUpdate());
    this.contentMutationObserver.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // 4) تغییر style/class خود element (بدون subtree — فقط خودش)
    this.attributeMutationObserver = new MutationObserver(() => this.scheduleUpdate());
    this.attributeMutationObserver.observe(el, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    this.scheduleUpdate();
  }

  private disconnectObservers() {
    this.elementResizeObserver?.disconnect();
    this.parentResizeObserver?.disconnect();
    this.contentMutationObserver?.disconnect();
    this.attributeMutationObserver?.disconnect();

    this.elementResizeObserver = undefined;
    this.parentResizeObserver = undefined;
    this.contentMutationObserver = undefined;
    this.attributeMutationObserver = undefined;
  }

  /**
   * به جای اینکه هر بار مستقیم updatePosition صدا بزنیم،
   * با rAF یک frame صبر میکنیم تا browser layout رو finish کنه
   * و چند تا observer که همزمان fire میکنن debounce بشن
   */
  private scheduleUpdate() {
    this.cancelScheduledUpdate();
    this.rafId = requestAnimationFrame(() => this.updatePosition());
  }

  private cancelScheduledUpdate() {
    if (this.rafId !== undefined) {
      cancelAnimationFrame(this.rafId);
      this.rafId = undefined;
    }
  }

  updatePosition() {
    if (!this.item?.el) return;

    const rect = this.item.el.getBoundingClientRect();

    // اگه element هنوز در DOM نیست
    if (rect.width === 0 && rect.height === 0 && rect.x === 0 && rect.y === 0) return;

    this.x = window.scrollX + rect.x;
    this.y = window.scrollY + rect.y;
    this.width = rect.width;
    this.height = rect.height;
    this.showInBottom = rect.y < 0 || rect.y - 24 < this.headerOffset;

    this.chdRef.detectChanges();
  }

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
