import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  viewChild,
  type AfterViewInit,
  type OnInit,
} from '@angular/core';
import { NgxDraggable, NgxDropList } from 'ngx-kit/drag-resize';
import { BlockSelectorComponent } from '../../components/block-selector/block-selector.component';
import { PageBuilderService } from '../../services/page-builder.service';
import { LibConsts } from 'ngx-page-builder/core';

@Component({
  template: `
    @let ci = pb.currentPageIndex();
    @let cp = pb.pageInfo.pages[ci];

    <div [class]="containerClassName">
      @if (viewMode == 'PrintPage') {
        <div
          class="page-header"
          #headerEl
          [class.show-outlines]="pb.showOutlines()"
          ngxDropList
          [data]="cp.headerItems"
          [class.is-empty]="!cp.headerItems.length"
          (drop)="pb.onDrop($event)"></div>

        <div
          class="page-body"
          #bodyEl
          [class.show-outlines]="pb.showOutlines()"
          ngxDropList
          [data]="cp.bodyItems"
          (drop)="pb.onDrop($event)"></div>

        <div
          class="page-footer"
          #footerEl
          [class.show-outlines]="pb.showOutlines()"
          ngxDropList
          [class.is-empty]="!cp.footerItems.length"
          [data]="cp.footerItems"
          (drop)="pb.onDrop($event)"></div>
      } @else {
        <div
          class="page-body"
          #bodyEl
          [class.show-outlines]="pb.showOutlines()"
          ngxDropList
          [data]="cp.bodyItems"
          (drop)="pb.onDrop($event)"></div>
      }
    </div>

    <block-selector #blockSelector />
  `,
  styleUrls: ['./base-content.scss', '../../styles/paper.scss'],
  imports: [NgxDropList, NgxDraggable, BlockSelectorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BaseContentComponent implements OnInit, AfterViewInit {
  containerClassName = 'ngx-page-builder';

  headerEl = viewChild<ElementRef<HTMLElement>>('headerEl');
  bodyEl = viewChild<ElementRef<HTMLElement>>('bodyEl');
  footerEl = viewChild<ElementRef<HTMLElement>>('footerEl');

  blockSelector = viewChild<BlockSelectorComponent>('blockSelector');
  viewMode = LibConsts.viewMode;
  readonly pb = inject(PageBuilderService);
  ngOnInit(): void {
    this.pb.blockSelector = this.blockSelector();
    if (LibConsts.viewMode == 'PrintPage') {
      this.containerClassName += ` ngx-paper ${this.pb.pageInfo.config.size} ${this.pb.pageInfo.config.orientation}`;
    } else {
      this.containerClassName += ` web-page-view`;
    }
  }
  ngAfterViewInit(): void {
    this.pb.pageHeaderEl = this.headerEl()?.nativeElement;
    this.pb.pageBodyEl = this.bodyEl()?.nativeElement;
    this.pb.pageFooterEl = this.footerEl()?.nativeElement;
  }
}
