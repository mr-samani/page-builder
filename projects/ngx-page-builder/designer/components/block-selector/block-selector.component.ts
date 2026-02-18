import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, HostListener, Injector, OnDestroy, OnInit } from '@angular/core';
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

  private resizeObserver?: ResizeObserver;
  private mutationObserver?: MutationObserver;

  constructor(injector: Injector) {
    super(injector);

    // Signal effect: runs when activeEl changes
    effect(() => {
      const newItem = this.pageBuilder.activeEl();
      this.item = newItem;
      // console.log('Active element changed:', newItem);
      this.observeActiveElement();
    });

    this.pageBuilder.changed$.subscribe((data) => {
      this.item = data.item;
      this.observeActiveElement();
    });
  }

  @HostListener('window:resize')
  onPageResize() {
    this.updatePosition();
  }

  ngOnDestroy() {
    this.disconnectObservers();
  }

  private observeActiveElement() {
    this.disconnectObservers();

    if (this.item) {
      if (!this.item.el) return;

      // Watch for resize
      this.resizeObserver = new ResizeObserver((c) => this.updatePosition());
      this.resizeObserver.observe(this.item.el);

      // Watch for style/class changes (margin/padding/etc.)
      this.mutationObserver = new MutationObserver((c) => this.updatePosition());
      this.mutationObserver.observe(this.item.el, {
        attributes: true,
        attributeFilter: ['style', 'class'],
      });

      this.updatePosition();
    }
    this.chdRef.detectChanges();
  }

  private disconnectObservers() {
    if (!this.item || !this.item.el) return;

    if (this.resizeObserver && this.item.el) {
      try {
        this.resizeObserver.unobserve(this.item.el);
      } catch {}
    }
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
    this.resizeObserver = undefined;
    this.mutationObserver = undefined;
  }

  updatePosition() {
    // if (!this.item) {
    //   this.x = this.y = this.width = this.height = 0;
    //   this.chdRef.detectChanges();
    //   return;
    // }

    if (!this.item || !this.item.el) return;

    const rect = this.item.el.getBoundingClientRect();
    if (rect.x == 0 && rect.y == 0 && rect.width == 0 && rect.height == 0) {
      return;
    }
    this.x = window.scrollX + rect.x;
    this.y = window.scrollY + rect.y;
    this.width = rect.width;
    this.height = rect.height;

    this.showInBottom = rect.y < 0 || rect.y - 24 < this.headerOffset;
    this.chdRef.detectChanges();
  }

  async deleteBlock() {
    if (this.item && !this.item.disableDelete) {
      await this.pageBuilder.removeBlock(this.item);
    }
  }

  selectParent(ev: PointerEvent) {
    if (this.item && this.item.parent) {
      this.pageBuilder.onSelectBlock(this.item.parent, ev);
    }
  }
}
