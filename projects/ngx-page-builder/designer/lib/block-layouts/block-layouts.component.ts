import { CommonModule } from '@angular/common';
import { Component, effect, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { SvgIconDirective } from '../../directives/svg-icon.directive';
import { debounceTime, distinctUntilChanged, filter, Subscription } from 'rxjs';
import { PageItem, Page } from 'ngx-page-builder/core';
import { PageBuilderBaseComponent } from '../page-builder-base-component';
import { NgxDropListGroup, NgxDraggable, NgxDropList, IDropEvent } from 'ngx-kit/drag-resize';
@Component({
  selector: 'block-layouts',
  templateUrl: './block-layouts.component.html',
  styleUrls: ['./block-layouts.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, SvgIconDirective, NgxDropListGroup, NgxDraggable, NgxDropList],
})
export class BlockLayoutsComponent extends PageBuilderBaseComponent implements OnInit, OnDestroy {
  currentPageHeaderItems: PageItem[] = [];
  currentPageFooterItems: PageItem[] = [];
  currentPageBodyItems: PageItem[] = [];
  pagebuiderChangeSubscription: Subscription;
  constructor() {
    super();
    effect(() => {
      const activeItem = this.pb.activeEl();
      this.openToParent(activeItem);
    });
    this.pb.onPageChange$.subscribe((page) => {
      this.reloadLayout(page);
    });

    this.pagebuiderChangeSubscription = this.pb.changed$
      .pipe(
        debounceTime(300),
        filter((data) => data.type == 'AddBlock' || data.type == 'RemoveBlock' || data.type == 'MoveBlock'),
        distinctUntilChanged((prv, cur) => {
          return prv.item?.id == cur.item?.id && prv.type == cur.type;
        }),
      )
      .subscribe((data) => {
        const page = this.pb.currentPage;
        this.reloadLayout(page, true);
      });
  }

  ngOnInit() {}

  ngOnDestroy(): void {
    this.pagebuiderChangeSubscription.unsubscribe();
  }
  reloadLayout(page?: Page, update = false) {
    this.currentPageBodyItems = page ? [...page.bodyItems] : [];
    this.currentPageHeaderItems = page ? [...page.headerItems] : [];
    this.currentPageFooterItems = page ? [...page.footerItems] : [];
    if (update) {
      this.chdRef.detectChanges();
    }
    // console.log('Layout reloaded:', {
    //   header: this.currentPageHeaderItems,
    //   body: this.currentPageBodyItems,
    //   footer: this.currentPageFooterItems,
    // });
  }

  onSelectBlock(ev: PointerEvent, item: PageItem) {
    this.pb.selectBlock(item, ev);
  }

  openToParent(item?: PageItem) {
    if (!item) return;
    (item as any).isOpen = true;
    if (item.parent) {
      this.openToParent(item.parent);
    }
  }

  async onDrop(ev: IDropEvent<PageItem[]>, parent?: PageItem) {
    const dragItem = ev.previousContainer.data?.[ev.previousIndex];
    const containerEl = parent?.el;
    if (!dragItem || !containerEl || !ev.previousContainer.data || !ev.container.data) {
      return;
    }
    // transferArrayItem(ev.previousContainer.data, ev.container.data, ev.previousIndex, ev.currentIndex);
    await this.pb.removeBlock(dragItem);
    dragItem.parent = parent;
    await this.pb.createBlockElement(true, dragItem, containerEl, ev.currentIndex);
    ev.container.data.splice(ev.currentIndex, 0, dragItem);

    this.pb.updateChangeDetection({
      item: dragItem,
      parent: ev.container.data,
      type: 'MoveBlock',
    });

    this.history.saveMove(
      dragItem.id,
      dragItem.parent?.id,
      ev.container.data?.[ev.currentIndex]?.parent?.id,
      ev.previousIndex,
      ev.currentIndex,
      dragItem,
      `Move block '${dragItem.id}' from: '${dragItem.parent?.id}' to: '${dragItem?.parent?.id}'`,
    );
  }
}
