import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  viewChild,
  ViewEncapsulation,
  type AfterViewInit,
  type OnInit,
} from '@angular/core';
import { NgxDropList } from 'ngx-kit/drag-resize';
import { BlockSelectorComponent } from '../../components/block-selector/block-selector.component';
import { PageBuilderService } from '../../services/page-builder.service';
import { LibConsts } from 'ngx-page-builder/core';

@Component({
  template: `
    @let ci = pb.currentPageIndex();
    @let cp = pb.pageInfo.pages[ci];

    <div [class]="containerClassName" [class.show-outlines]="pb.showOutlines()">
      @if (viewMode == 'PrintPage') {
        <div
          class="page-header"
          #headerEl
          ngxDropList
          [data]="cp.headerItems"
          [class.is-empty]="!cp.headerItems.length"
          (drop)="pb.onDrop($event)"></div>

        <div class="page-body" #bodyEl ngxDropList [data]="cp.bodyItems" (drop)="pb.onDrop($event)"></div>

        <div
          class="page-footer"
          #footerEl
          ngxDropList
          [class.is-empty]="!cp.footerItems.length"
          [data]="cp.footerItems"
          (drop)="pb.onDrop($event)"></div>
      } @else {
        <div class="page-body" #bodyEl ngxDropList [data]="cp.bodyItems" (drop)="pb.onDrop($event)"></div>
      }
    </div>

    <block-selector #blockSelector />
  `,
  styleUrls: ['./base-content.scss', '../../styles/paper.scss'],
  imports: [NgxDropList, BlockSelectorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
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
