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
    classList: [],
    children: [],
    css: {
      base: `
    position: relative;
    flex: auto;
    box-shadow: 0 0px 4px rgba(0, 0, 0, 0.3);
    padding: 10px;
    border-radius: 5px;
    overflow: hidden;
    min-height: 220px;
    min-width: 150px;`,
    },
  };

  dataList: DynamicDataStructure[][] = [];

  private context = inject<ComponentDataContext<DataSourceSetting>>(COMPONENT_DATA);
  protected readonly pb = inject(PageBuilderService);

  constructor(
    private chdRef: ChangeDetectorRef,
    private dynamicElementService: DynamicElementService,
    private dynamicDataService: DynamicDataService,
    private elRef: ElementRef<HTMLElement>,
  ) {
    this.settingChangeSubscription = this.context.onChange.subscribe((data: DataSourceSetting) => {
      if (this.pageItem) {
        this.pageItem.dataSource = data;
      }
      this.getData();
      this.chdRef.detectChanges();
    });
    /**
     * TODO: need enhancement for improve performance and avoid unnecessary updates
     * - change block content -> not rebuild all: only update same contents
     * - move block -> not rebuild all: only move same contents
     * - addd block only add new block
     */
    this.pagebuiderChangeSubscription = this.pb.changed$.pipe(debounceTime(300)).subscribe(async (data) => {
      if (
        data.type == 'AddBlock' ||
        data.type == 'RemoveBlock' ||
        data.type == 'MoveBlock' ||
        data.type == 'ChangeBlockContent' ||
        data.type == 'ChangeBlockProperties' ||
        data.type == 'ChangeTagName' ||
        data.type == 'ChangeClassName'
      ) {
        // console.log('Block changed:', data.item?.id, data.type, data.item?.style);
        const found = itemInThisTemplate(data.item, this.pageItem.children);
        if (found.result) {
          console.time('updateTemplate');
          this.pageItem.template = cloneDeep(found.root!);
          await this.update(data);
          console.timeEnd('updateTemplate');
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
    if (!this.pageItem || !this.pageItem.dataSource || !this.pageItem.template) {
      return;
    }
    // filters / sorts / skip / take are applied by the service; when the list is empty the designer shows sample records
    const result = await this.dynamicDataService.queryCollection(this.pageItem.dataSource, { sampleWhenEmpty: true });
    this.dataList = result.rows;
    this.update();
  }

  async update(change?: PageItemChange) {
    if (!this.pageItem || !this.pageItem.template) return;

    await this.clearContainer();
    this.pageItem.children = [];

    const childCount = this.dataList.length;
    for (let i = 0; i < childCount; i++) {
      let cloned = cloneTemplate(this.dataList, this.pageItem.template!, i);
      cloned.parent = this.pageItem;
      await this.pb.createBlockElement(this.editMode, cloned, this.elRef.nativeElement);
      this.pageItem.children.push(cloned);
    }
    this.chdRef.detectChanges();
  }

  private async clearContainer() {
    await this.dynamicElementService.destroyBatch(this.pageItem.children);
  }
}
