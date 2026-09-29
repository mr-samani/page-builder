import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  viewChild,
  type AfterViewInit,
  type OnInit,
} from '@angular/core';
import { PageBuilderBaseComponent } from '../page-builder-base-component';
import { NgxDropList } from 'ngx-kit/drag-resize';
import { BlockSelectorComponent } from '../../components/block-selector/block-selector.component';

@Component({
  template: `
    <div [hidden]="pb.currentPageIndex() < 0" [class]="containerClassName">
      @if (viewMode == 'PrintPage') {
        <div
          class="page-header"
          #headerEl
          [class.show-outlines]="pb.showOutlines()"
          ngxDropList
          [data]="pb.pageInfo.pages[pb.currentPageIndex()]?.headerItems"
          [class.is-empty]="!pb.pageInfo.pages[pb.currentPageIndex()]?.headerItems?.length"
          (drop)="pb.onDrop($event)"></div>

        <div
          class="page-body"
          #bodyEl
          [class.show-outlines]="pb.showOutlines()"
          ngxDropList
          [data]="pb.pageInfo.pages[pb.currentPageIndex()]?.bodyItems"
          (drop)="pb.onDrop($event)"></div>

        <div
          class="page-footer"
          #footerEl
          [class.show-outlines]="pb.showOutlines()"
          ngxDropList
          [class.is-empty]="!pb.pageInfo.pages[pb.currentPageIndex()]?.footerItems?.length"
          [data]="pb.pageInfo.pages[pb.currentPageIndex()]?.footerItems"
          (drop)="pb.onDrop($event)"></div>
      } @else {
        <div
          class="page-body"
          #bodyEl
          [class.show-outlines]="pb.showOutlines()"
          ngxDropList
          [data]="pb.pageInfo.pages[pb.currentPageIndex()]?.bodyItems?.at(0)?.children ?? []"
          (drop)="pb.onDrop($event, pb.pageInfo.pages[pb.currentPageIndex()]?.bodyItems?.at(0))"></div>
      }
    </div>
    <block-selector #blockSelector />
  `,
  imports: [NgxDropList, BlockSelectorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BaseContentComponent extends PageBuilderBaseComponent implements OnInit, AfterViewInit {
  containerClassName = '';

  headerEl = viewChild<ElementRef<HTMLElement>>('headerEl');
  bodyEl = viewChild<ElementRef<HTMLElement>>('bodyEl');
  footerEl = viewChild<ElementRef<HTMLElement>>('footerEl');

  blockSelector = viewChild<BlockSelectorComponent>('blockSelector');

  ngOnInit(): void {
    this.pb.blockSelector = this.blockSelector();

    if (this.viewMode == 'PrintPage') {
      this.containerClassName = `ngx-paper ${this.pb.pageInfo.config.size} ${this.pb.pageInfo.config.orientation}`;
    } else {
      this.containerClassName = `web-page-view`;
    }
  }
  ngAfterViewInit(): void {
    this.pb.pageHeaderEl = this.headerEl()?.nativeElement;
    this.pb.pageBodyEl = this.bodyEl()?.nativeElement;
    this.pb.pageFooterEl = this.footerEl()?.nativeElement;
  }
}
