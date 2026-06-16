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
  DynamicDataStructure,
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

  dataList: DynamicDataStructure[][] = [];

  private context = inject<ComponentDataContext<DataSourceSetting>>(COMPONENT_DATA);
  constructor(
    private chdRef: ChangeDetectorRef,
    private dynamicElementService: DynamicElementService,
    private dynamicDataService: DynamicDataService,
    private previewService: PagePreviewService,
    private elRef: ElementRef<HTMLElement>,
  ) {
    if (this.pageItem) {
      this.pageItem.dataSource = this.context.data;
      this.chdRef.detectChanges();
    }
    this.getData();
  }

  ngOnInit() {
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
    const count = this.pageItem.dataSource?.maxResultCount || 10;
    const skip = this.pageItem.dataSource?.skipCount || 0;
    const params = this.pageItem.dataSource.params;

    if (this.pageItem.dataSource.id) {
      this.dataList = await this.dynamicDataService.getCollectionData(this.pageItem.dataSource.id, skip, count, params);
    }

    // const childCount = Math.min(count, this.dataList.length);
    const childCount = count;

    this.clearContainer();
    this.pageItem.children = [];
    for (let i = 0; i < childCount; i++) {
      let cloned = cloneTemplate(this.dataList, this.pageItem.template!, i);

      await this.previewService.createBlockElement(cloned, this.elRef.nativeElement);
      this.pageItem.children.push(cloned);
    }
    // console.log('data-collection', this.pageItem.id, this.pageItem);
    this.chdRef.detectChanges();
  }

  private clearContainer() {
    this.dynamicElementService.destroyBatch(this.pageItem.children);
  }
}
