import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  Inject,
  Input,
  OnInit,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { TableSetting } from './table-setting';
import { _td, _template, _th } from './template';
import { SelectedCellInfo, RangeSelectionInfo } from './model';
import { CommonModule } from '@angular/common';

import {
  COMPONENT_DATA,
  ComponentDataContext,
  DynamicDataService,
  DynamicDataStructure,
  DynamicElementService,
  PageItem,
  PagePreviewService,
  cloneTemplate,
} from 'ngx-page-builder/core';

@Component({
  selector: 'hero-table',
  templateUrl: './hero-table.component.html',
  styleUrls: ['./hero-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  encapsulation: ViewEncapsulation.None,
})
export class PreviewHeroTableComponent implements OnInit, AfterViewInit {
  // inputs auto filled by create dynamic element
  @Input() pageItem!: PageItem;
  settingChangeSubscription?: Subscription;

  @ViewChild('tableContainer') tableContainer!: ElementRef<HTMLTableElement>;
  @ViewChild('wrapper') wrapper!: ElementRef<HTMLDivElement>;
  @ViewChild('toolbar', { static: false }) toolbar?: ElementRef<HTMLDivElement>;
  @ViewChild('selectionRange', { static: false }) selectionRangeEl?: ElementRef<HTMLDivElement>;

  /**
   * if is dynamic rows and selected cell in body , can not change rows
   */
  canChangeRows: boolean = true;

  firstSelectedCell?: SelectedCellInfo;
  rangeSelection?: RangeSelectionInfo;

  showMergeButton: boolean = false;

  dataList: DynamicDataStructure[][] = [];

  settings: TableSetting = new TableSetting();

  private context = inject<ComponentDataContext<TableSetting>>(COMPONENT_DATA);
  constructor(
    private chdRef: ChangeDetectorRef,
    private pagePreviewService: PagePreviewService,
    private dynamicElementService: DynamicElementService,
    private dynamicDataService: DynamicDataService,
  ) {
    if (this.pageItem) {
      this.pageItem.dataSource = this.context.data;
      this.pageItem.customComponent!.componentData = this.context.data;
      this.settings = this.context.data;
    }
  }

  ngOnInit() {
    if (this.pageItem.customComponent?.componentData) {
      this.settings = this.pageItem.customComponent?.componentData as TableSetting;
    }
    if (!this.pageItem.template) {
      this.pageItem.template = new PageItem(_template, this.pageItem);
    } else {
      this.pageItem.template.isTemplateContainer = true;
    }
  }

  ngAfterViewInit(): void {
    this.generate();
  }

  ngOnDestroy() {
    if (this.settingChangeSubscription) {
      this.settingChangeSubscription.unsubscribe();
    }
  }

  async generate() {
    if (!this.pageItem.template) {
      this.pageItem.template = new PageItem(_template, this.pageItem);
    } else {
      this.pageItem.template.isTemplateContainer = true;
    }
    await this.clearContainer();
    // dynamic rows
    if (this.settings.useDynamicData && this.pageItem.dataSource && this.pageItem.dataSource.id) {
      const skip = this.pageItem.dataSource?.skipCount || 0;
      const count = this.pageItem.dataSource?.maxResultCount || 10;
      const params = this.pageItem.dataSource.params;

      const body = this.pageItem.template.children.find((x: PageItem) => x.tag === 'tbody')!;
      const bodyTemplate = body.children[0];
      this.dataList = [];
      if (this.pageItem.dataSource.id) {
        this.dataList = await this.dynamicDataService.getCollectionData(
          this.pageItem.dataSource.id,
          skip,
          count,
          params,
        );
      }

      const childCount = Math.min(count, this.dataList.length);
      body.children = [];
      for (let i = 0; i < childCount; i++) {
        let cloned = cloneTemplate(this.dataList, bodyTemplate!, i);
        body.children.push(cloned);
      }
      this.pageItem.children = [new PageItem(this.pageItem.template, this.pageItem)];
    }
    // static rows
    else {
      this.pageItem.template = undefined;
    }
    if (!this.pageItem.children || this.pageItem.children.length === 0) {
      this.pageItem.children = [new PageItem(_template, this.pageItem)];
    }

    await this.pagePreviewService.createBlockElement(this.pageItem.children[0], this.tableContainer.nativeElement);
    this.chdRef.detectChanges();
  }
  private async clearContainer() {
    await this.dynamicElementService.destroyBatch(this.pageItem.children);
  }
}
