import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
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
export class CollectionItemComponent implements OnInit, OnDestroy, AfterViewInit {
  // inputs auto filled by create dynamic element
  @Input() editMode: boolean = false;
  @Input() pageItem!: PageItem;
  settingChangeSubscription?: Subscription;

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
  @ViewChild('collectionContainer') collectionContainer!: ElementRef<HTMLDivElement>;

  constructor(
    @Inject(COMPONENT_DATA) private context: ComponentDataContext<DataSourceSetting>,
    private chdRef: ChangeDetectorRef,
    private dynamicElementService: DynamicElementService,
    private dynamicDataService: DynamicDataService,
    private previewService: PagePreviewService
  ) {
    this.settingChangeSubscription = this.context.onChange.subscribe((data: DataSourceSetting) => {
      this.pageItem.dataSource = data;
      this.getData();
      this.chdRef.detectChanges();
    });
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
  ngOnDestroy(): void {
    if (this.settingChangeSubscription) {
      this.settingChangeSubscription.unsubscribe();
    }
  }
  async getData() {
    this.dataList = [];
    if (!this.pageItem.dataSource || !this.pageItem.template) {
      return;
    }
    const count = this.pageItem.dataSource?.maxResultCount || 10;
    const skip = this.pageItem.dataSource?.skipCount || 0;
    if (this.pageItem.dataSource.id) {
      this.dataList = this.dynamicDataService.getCollectionData(
        this.pageItem.dataSource.id,
        skip,
        count
      );
    }

    // const childCount = Math.min(count, this.dataList.length);
    const childCount = count;

    this.clearContainer();
    this.pageItem.children = [];
    for (let i = 0; i < childCount; i++) {
      let cloned = cloneTemplate(this.dataList, this.pageItem.template!, i);

      await this.previewService.createBlockElement(cloned, this.collectionContainer.nativeElement);
      this.pageItem.children.push(cloned);
    }
    // console.log('data-collection', this.pageItem.id, this.pageItem);
    this.chdRef.detectChanges();
  }

  private clearContainer() {
    this.dynamicElementService.destroyBatch(this.pageItem.children);
  }
}
