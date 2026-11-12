import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Subscription } from 'rxjs';

import {
  COMPONENT_DATA,
  ComponentDataContext,
  DataSourceSetting,
  DynamicDataService,
  DynamicElementService,
  IPageItem,
  PageItem,
  PagePreviewService,
  cloneTemplate,
} from 'ngx-page-builder/core';

@Component({
  selector: 'collection-item',
  templateUrl: './collection-item.component.html',
  styleUrls: ['./collection-item.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
})
export class PreviewCollectionItemComponent implements OnInit, OnDestroy, AfterViewInit {
  // inputs auto filled by create dynamic element
  @Input() editMode: boolean = false;
  @Input() pageItem!: PageItem;

  _template: IPageItem = {
    tag: 'article',
    isTemplateContainer: true,
    canHaveChild: true,
    disableMovement: true,
    lockMoveInnerChild: true,
    disableDelete: true,
    classList: ['card-collection'],
    children: [],
  };

  dataList: any[] = [];

  private context = inject<ComponentDataContext<DataSourceSetting>>(COMPONENT_DATA);
  constructor(
    private chdRef: ChangeDetectorRef,
    private dynamicElementService: DynamicElementService,
    private dynamicDataService: DynamicDataService,
    private previewService: PagePreviewService,
    private elRef: ElementRef<HTMLElement>,
  ) {}

  ngOnInit() {
    // the saved settings of the block (normally already on the page item)
    if (!this.pageItem.dataSource?.id && this.context?.data?.id) {
      this.pageItem.dataSource = this.context.data;
    }
    if (!this.pageItem.template) {
      this.pageItem.template = new PageItem(this._template, this.pageItem);
    } else {
      this.pageItem.template.isTemplateContainer = true;
    }
  }

  ngAfterViewInit(): void {
    this.getData();
  }
  ngOnDestroy(): void {}
  async getData() {
    this.dataList = [];
    if (!this.pageItem || !this.pageItem.dataSource || !this.pageItem.template) {
      return;
    }
    const result = await this.dynamicDataService.queryCollection(this.pageItem.dataSource);
    this.dataList = result.rows;
    const childCount = this.dataList.length;

    await this.clearContainer();
    this.pageItem.children = [];
    for (let i = 0; i < childCount; i++) {
      let cloned = cloneTemplate(this.dataList, this.pageItem.template!, i);

      await this.previewService.createBlockElement(cloned, this.elRef.nativeElement);
      this.pageItem.children.push(cloned);
    }
    this.chdRef.detectChanges();
  }

  private async clearContainer() {
    await this.dynamicElementService.destroyBatch(this.pageItem.children);
  }
}
