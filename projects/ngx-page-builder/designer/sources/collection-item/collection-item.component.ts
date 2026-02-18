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
import { debounceTime, Subscription } from 'rxjs';
import { PageBuilderService, PageItemChange } from '../../services/page-builder.service';

import {
  COMPONENT_DATA,
  ComponentDataContext,
  DataSourceSetting,
  DynamicDataService,
  DynamicDataStructure,
  DynamicElementService,
  IPageItem,
  PageItem,
  cloneDeep,
  cloneTemplate,
  itemInThisTemplate,
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
  pagebuiderChangeSubscription?: Subscription;

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

  private context = inject<ComponentDataContext<DataSourceSetting>>(COMPONENT_DATA);
  constructor(
    private chdRef: ChangeDetectorRef,
    private pageBuilder: PageBuilderService,
    private dynamicElementService: DynamicElementService,
    private dynamicDataService: DynamicDataService,
  ) {
    this.settingChangeSubscription = this.context.onChange.subscribe((data: DataSourceSetting) => {
      this.pageItem.dataSource = data;
      this.getData();
      this.chdRef.detectChanges();
    });
    /**
     * TODO: need enhancement for improve performance and avoid unnecessary updates
     * - change block content -> not rebuild all: only update same contents
     * - move block -> not rebuild all: only move same contents
     * - addd block only add new block
     */
    this.pagebuiderChangeSubscription = this.pageBuilder.changed$.pipe(debounceTime(300)).subscribe((data) => {
      if (
        data.type == 'AddBlock' ||
        data.type == 'RemoveBlock' ||
        data.type == 'MoveBlock' ||
        data.type == 'ChangeBlockContent' ||
        data.type == 'ChangeBlockProperties'
      ) {
        // console.log('Block changed:', data.item?.id, data.type, data.item?.style);
        const found = itemInThisTemplate(data.item, this.pageItem.children);
        if (found.result) {
          console.time('updateTemplate');
          this.pageItem.template = cloneDeep(found.root!);
          console.timeEnd('updateTemplate');
          this.update(data);
        }
      }
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
    if (this.pagebuiderChangeSubscription) {
      this.pagebuiderChangeSubscription.unsubscribe();
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
      this.dataList = this.dynamicDataService.getCollectionData(this.pageItem.dataSource.id, skip, count);
    }

    // const childCount = Math.min(count, this.dataList.length);
    const childCount = count;

    this.clearContainer();
    this.pageItem.children = [];
    for (let i = 0; i < childCount; i++) {
      let cloned = cloneTemplate(this.dataList, this.pageItem.template!, i);
      await this.pageBuilder.createBlockElement(true, cloned, this.collectionContainer.nativeElement);
      this.pageItem.children.push(cloned);
    }
    // console.log('data-collection', this.pageItem.id, this.pageItem);
    this.chdRef.detectChanges();
  }

  async update(change: PageItemChange) {
    if (!this.pageItem || !this.pageItem.template || !change.item) return;

    this.clearContainer();
    this.pageItem.children = [];

    const count = this.pageItem.dataSource?.maxResultCount || 10;
    //const childCount = Math.min(count, this.dataList.length);
    const childCount = count;
    for (let i = 0; i < childCount; i++) {
      let cloned = cloneTemplate(this.dataList, this.pageItem.template!, i);
      await this.pageBuilder.createBlockElement(this.editMode, cloned, this.collectionContainer.nativeElement);
      this.pageItem.children.push(cloned);
    }
    this.chdRef.detectChanges();
  }

  private clearContainer() {
    this.dynamicElementService.destroyBatch(this.pageItem.children);
  }
}
