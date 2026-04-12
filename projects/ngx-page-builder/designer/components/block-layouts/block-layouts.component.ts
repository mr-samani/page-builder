import { CommonModule } from '@angular/common';
import { Component, effect, Injector, OnDestroy, OnInit } from '@angular/core';
import { BaseComponent } from '../BaseComponent';
import { SvgIconDirective } from '../../directives/svg-icon.directive';
import { debounceTime, distinctUntilChanged, filter, Subscription } from 'rxjs';
import { PageItem } from 'ngx-page-builder/core';
import { Page } from 'ngx-page-builder/core';
@Component({
  selector: 'block-layouts',
  templateUrl: './block-layouts.component.html',
  styleUrls: ['./block-layouts.component.scss'],
  standalone: true,
  imports: [CommonModule, SvgIconDirective],
})
export class BlockLayoutsComponent extends BaseComponent implements OnInit, OnDestroy {
  currentPageHeaderItems: PageItem[] = [];
  currentPageFooterItems: PageItem[] = [];
  currentPageBodyItems: PageItem[] = [];
  pagebuiderChangeSubscription: Subscription;
  constructor(injector: Injector) {
    super(injector);
    effect(() => {
      const activeItem = this.pageBuilder.activeEl();
      this.openToParent(activeItem);
    });
    this.pageBuilder.onPageChange$.subscribe((page) => {
      this.reloadLayout(page);
    });

    this.pagebuiderChangeSubscription = this.pageBuilder.changed$
      .pipe(
        debounceTime(300),
        filter((data) => data.type == 'AddBlock' || data.type == 'RemoveBlock' || data.type == 'MoveBlock'),
        distinctUntilChanged((prv, cur) => {
          return prv.item?.id == cur.item?.id && prv.type == cur.type;
        }),
      )
      .subscribe((data) => {
        const page = this.pageBuilder.currentPage;
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
    this.pageBuilder.selectBlock(item, ev);
  }

  openToParent(item?: PageItem) {
    if (!item) return;
    (item as any).isOpen = true;
    if (item.parent) {
      this.openToParent(item.parent);
    }
  }
}
