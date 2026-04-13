import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DOCUMENT,
  ElementRef,
  inject,
  Inject,
  Input,
  OnInit,
  Renderer2,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { debounceTime, Subscription } from 'rxjs';
import { PageBuilderService } from '../../services/page-builder.service';
import { NgxDragDropKitModule } from 'ngx-drag-drop-kit';

import { BlockHelper } from '../../helper/BlockHelper';
import { SvgIconDirective } from '../../directives/svg-icon.directive';
import { buildLogicalGrid, findCellLogicalIndex, getNormalizedRange, isValidMergeRange } from './table-utiles';
import { TableSetting } from './table-setting';
import { TableHelper } from './table-helper';
import { _td, _template, _th } from './template';
import { SelectedCellInfo, RangeSelectionInfo, TableSection } from './model';
import { CommonModule } from '@angular/common';

import {
  COMPONENT_DATA,
  ComponentDataContext,
  DynamicDataService,
  DynamicDataStructure,
  DynamicElementService,
  PageItem,
  cloneDeep,
  cloneTemplate,
  itemInThisTemplate,
} from 'ngx-page-builder/core';

@Component({
  selector: 'hero-table',
  templateUrl: './hero-table.component.html',
  styleUrls: ['./hero-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, NgxDragDropKitModule, SvgIconDirective],
  encapsulation: ViewEncapsulation.None,
})
export class HeroTableComponent implements OnInit, AfterViewInit {
  // inputs auto filled by create dynamic element
  @Input() editMode: boolean = false;
  @Input() pageItem!: PageItem;
  settingChangeSubscription?: Subscription;
  selectBlockSubscription?: Subscription;
  pagebuiderChangeSubscription?: Subscription;

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
  private doc = inject(DOCUMENT);

  constructor(
    private chdRef: ChangeDetectorRef,
    private pb: PageBuilderService,
    private dynamicElementService: DynamicElementService,
    private dynamicDataService: DynamicDataService,
    private renderer: Renderer2,
  ) {
    this.handlePageBuilderChange();
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
    this.settingChangeSubscription = this.context.onChange.subscribe((data: TableSetting) => {
      this.pageItem.dataSource = data;
      this.pageItem.customComponent!.componentData = data;
      this.settings = data;

      this.generate();
      this.chdRef.detectChanges();
    });
    this.selectBlockSubscription = this.pb.onSelectBlock$.subscribe((result) => {
      this.onSelectCell(result?.item, result?.ev);
      this.checkCanChangeRows();
    });
    this.generate();
  }

  handlePageBuilderChange() {
    /**
     * TODO: need enhancement for improve performance and avoid unnecessary updates
     * - change block content -> not rebuild all: only update same contents
     * - move block -> not rebuild all: only move same contents
     * - addd block only add new block
     */
    this.pagebuiderChangeSubscription = this.pb.changed$.pipe(debounceTime(300)).subscribe((data) => {
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
          this.generate();
        }
      }
    });
  }

  ngOnDestroy() {
    if (this.settingChangeSubscription) {
      this.settingChangeSubscription.unsubscribe();
    }
    if (this.selectBlockSubscription) {
      this.selectBlockSubscription.unsubscribe();
    }
    if (this.pagebuiderChangeSubscription) {
      this.pagebuiderChangeSubscription.unsubscribe();
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

    await this.pb.createBlockElement(this.editMode, this.pageItem.children[0], this.tableContainer.nativeElement);
    this.chdRef.detectChanges();
  }
  private async clearContainer() {
    await this.dynamicElementService.destroyBatch(this.pageItem.children);
  }

  /**
   * Selection handler (supports Shift selection for range)
   */
  onSelectCell(selectedBlock: PageItem | undefined, ev?: PointerEvent) {
    try {
      const isShift = !!ev?.shiftKey;
      if (!selectedBlock) {
        throw new Error('No selected block');
      }

      const cell = BlockHelper.findParentByTag(selectedBlock, ['td', 'th'], ['tbody', 'thead', 'tfoot']);
      if (!cell) {
        throw new Error('No cell found');
      }
      const row = BlockHelper.findParentByTag(cell, ['tr'], ['tbody', 'thead', 'tfoot']);
      if (!row) {
        throw new Error('No row found');
      }
      const section = row.parent?.tag as TableSection;
      const bodyChilds = row.parent?.children ?? [];
      // 🔥 پیدا کردن ایندکسِ درست با محاسبه مرج شده‌ها
      const { rowIndex, colIndex } = findCellLogicalIndex(bodyChilds, cell);

      if (rowIndex < 0) {
        throw new Error('Row not found in parent children');
      }
      if (colIndex < 0) {
        throw new Error('Cell not found in row children');
      }

      // Shift selection: build range between firstSelectedCell and this
      if (isShift && this.firstSelectedCell && this.firstSelectedCell.section === section) {
        const start = {
          row: this.firstSelectedCell.rowIndex,
          col: this.firstSelectedCell.colIndex,
          block: this.firstSelectedCell.block,
        };
        const end = { row: rowIndex, col: colIndex, block: selectedBlock };

        // compute normalized range (use only row/col)
        const normalized = getNormalizedRange({ row: start.row, col: start.col }, { row: end.row, col: end.col });

        // validate using helper (pass the section rows array)
        const valid = isValidMergeRange(bodyChilds, normalized);
        if (valid) {
          this.rangeSelection = {
            section,
            row1: normalized.row1,
            row2: normalized.row2,
            col1: normalized.col1,
            col2: normalized.col2,
            start: { ...start },
            end: { ...end },
          };
        } else {
          this.rangeSelection = undefined;
        }

        this.chdRef.detectChanges();
        this.updateRangeSelectionPosition();
        this.updateToolbarPosition();
        return;
      }

      // normal selection: set as firstSelectedCell
      this.firstSelectedCell = { section, rowIndex, colIndex, block: selectedBlock };

      if (!isShift) {
        this.rangeSelection = undefined;
        this.updateRangeSelectionPosition();
      }

      this.updateToolbarPosition();
      this.chdRef.detectChanges();
    } catch (error) {
      // reset selection state on error
      this.firstSelectedCell = undefined;
      this.rangeSelection = undefined;
      this.updateRangeSelectionPosition();
      this.chdRef.detectChanges();
    }
  }

  checkCanChangeRows() {
    this.canChangeRows = false;
    if (!this.settings.useDynamicData || (this.firstSelectedCell && this.firstSelectedCell.section != 'tbody')) {
      this.canChangeRows = true;
    }
  }

  getRowColIndex(): { rowIndex: number; colIndex: number } {
    // اگر یک سلول از قبل انتخاب شده باشد، همان را برگردان
    if (this.firstSelectedCell) {
      return {
        rowIndex: this.firstSelectedCell.rowIndex,
        colIndex: this.firstSelectedCell.colIndex,
      };
    }

    // fallback ایمن: آخرین سلول tbody
    const body = this.pageItem?.children?.find((x: PageItem) => x.tag === 'tbody');
    if (!body || !Array.isArray(body.children) || body.children.length === 0) {
      // هیچ tbody یا هیچ ردیفی وجود ندارد -> صفر برگردان
      return { rowIndex: 0, colIndex: 0 };
    }

    // آخرین ردیف موجود
    const lastRowIndex = Math.max(0, body.children.length - 1);
    const lastRow = body.children[lastRowIndex];

    if (!lastRow || !Array.isArray(lastRow.children) || lastRow.children.length === 0) {
      // ردیف وجود دارد ولی سلولی داخلش نیست -> colIndex = 0
      return { rowIndex: lastRowIndex, colIndex: 0 };
    }

    // آخرین سلول (اندیس child)
    const lastColIndex = Math.max(0, lastRow.children.length - 1);
    return { rowIndex: lastRowIndex, colIndex: lastColIndex };
  }

  async addRow(ev: Event, after = false) {
    ev.stopPropagation();
    const { rowIndex, colIndex } = this.getRowColIndex();
    const section = this.firstSelectedCell?.section ?? 'tbody';
    const table = this.pageItem.children[0];
    await TableHelper.addRow(this.pb, table, section, after, rowIndex);
    this.update();
  }

  async deleteRow(ev: Event) {
    ev.stopPropagation();
    const { rowIndex, colIndex } = this.getRowColIndex();
    const section = this.firstSelectedCell?.section ?? 'tbody';
    const table = this.pageItem.children[0];
    await TableHelper.deleteRow(this.pb, this.dynamicElementService, table, section, rowIndex);

    this.update();
  }

  //_________________________________________________________

  async addColumn(ev: Event, after = false) {
    ev.stopPropagation();
    const { rowIndex, colIndex } = this.getRowColIndex();
    const table = this.pageItem.children[0];
    if (!table) return;
    await TableHelper.addColumn(table, colIndex, after);

    this.generate();
    this.update();
  }

  async deleteColumn(ev: Event) {
    ev.stopPropagation();
    const { rowIndex: childRowIdx, colIndex: childColIdx } = this.getRowColIndex();
    const table = this.pageItem.children?.[0];
    if (!table) return;

    const sectionName = this.firstSelectedCell?.section ?? 'tbody';
    const sectionBlock = table.children?.find((x: PageItem) => x.tag === sectionName) as PageItem;
    if (!sectionBlock) return;
    await TableHelper.deleteColumn(table, sectionName, childRowIdx, childColIdx, this.firstSelectedCell);

    this.pb.deSelectBlock();
    this.generate();
    this.update();
  }

  update() {
    this.pageItem.options ??= {};
    console.log('update called', this.pageItem);
    setTimeout(() => {
      // update new rowIndex and colIndex
      this.onSelectCell(this.firstSelectedCell?.block);
      this.checkCanChangeRows();

      this.pb.blockSelector?.updatePosition();
      this.updateToolbarPosition();
    });
  }

  updateToolbarPosition() {
    if (!this.selectionRangeEl || !this.toolbar || !this.firstSelectedCell?.block?.el) return;
    const rect = this.rangeSelection
      ? this.selectionRangeEl.nativeElement.getBoundingClientRect()
      : this.firstSelectedCell.block.el.getBoundingClientRect();
    const wrapperRect = this.wrapper.nativeElement.getBoundingClientRect();
    const toolbarWidth = this.toolbar.nativeElement.offsetWidth;
    const optX = rect.x - wrapperRect.x + (rect.width - toolbarWidth) / 2;
    const optY = rect.y - wrapperRect.y + rect.height;
    this.renderer.setStyle(this.toolbar.nativeElement, 'left', `${optX}px`);
    this.renderer.setStyle(this.toolbar.nativeElement, 'top', `${optY}px`);
  }

  updateRangeSelectionPosition() {
    this.showMergeButton = false;
    if (!this.selectionRangeEl) return;

    if (this.rangeSelection) {
      const startRect = this.rangeSelection.start.block?.el?.getBoundingClientRect();
      const endRect = this.rangeSelection.end.block?.el?.getBoundingClientRect();
      if (startRect && endRect) {
        this.showMergeButton = true;
        const wrapperRect = this.wrapper.nativeElement.getBoundingClientRect();
        const left = Math.min(startRect.left, endRect.left) - wrapperRect.left;
        const top = Math.min(startRect.top, endRect.top) - wrapperRect.top;
        const right = Math.max(startRect.right, endRect.right) - wrapperRect.left;
        const bottom = Math.max(startRect.bottom, endRect.bottom) - wrapperRect.top;
        this.renderer.setStyle(this.selectionRangeEl.nativeElement, 'left', `${left}px`);
        this.renderer.setStyle(this.selectionRangeEl.nativeElement, 'top', `${top}px`);
        this.renderer.setStyle(this.selectionRangeEl.nativeElement, 'width', `${right - left}px`);
        this.renderer.setStyle(this.selectionRangeEl.nativeElement, 'height', `${bottom - top}px`);
        this.renderer.setStyle(this.selectionRangeEl.nativeElement, 'display', 'block');
        const bs = this.doc.querySelector('block-selector');
        if (bs) {
          this.renderer.setStyle(bs, 'display', 'none');
        }
      }
    } else {
      this.renderer.setStyle(this.selectionRangeEl.nativeElement, 'display', 'none');
      const bs = this.doc.querySelector('block-selector');
      if (bs) {
        this.renderer.removeStyle(bs, 'display');
      }
    }
    this.chdRef.detectChanges();
  }

  async mergeCells(ev: Event) {
    if (!this.rangeSelection) return;
    const table = this.pageItem.children?.[0];
    if (!table) return;
    const { section, row1, col1 } = this.rangeSelection;

    await TableHelper.mergeCells(this.dynamicElementService, table, this.rangeSelection);

    // بازسازی DOM
    await this.generate();

    // selection: سعی کن master جدید را انتخاب کنی
    this.pb.deSelectBlock();
    setTimeout(() => {
      // بعد از generate دوباره grid و master را پیدا می‌کنیم تا selection بزنیم
      const tableAfter = this.pageItem.children?.[0];
      if (!tableAfter) return;
      const sectionAfter = tableAfter.children?.find((x: PageItem) => x.tag === section) as PageItem;
      if (!sectionAfter) return;
      // بازسازی grid بعدی
      const rowsAfter = sectionAfter.children ?? [];
      const gridAfter = buildLogicalGrid(rowsAfter);
      if (gridAfter?.[row1]?.[col1]) {
        const newMaster = gridAfter[row1][col1].cell;
        if (newMaster) {
          try {
            this.pb.selectBlock(newMaster);
          } catch (err) {
            // ignore
          }
        }
      }

      this.rangeSelection = undefined;
      this.firstSelectedCell = undefined;
      this.update();
    }, 50);
  }

  async unMergeCells(ev: Event) {
    ev.stopPropagation();

    if (!this.firstSelectedCell) return;
    const { section, rowIndex, colIndex } = this.firstSelectedCell;
    const table = this.pageItem?.children?.[0];
    if (!table) return;

    await TableHelper.unMergeCells(table, this.firstSelectedCell);

    // بازسازی DOM
    await this.generate();

    // دوباره selection و update
    setTimeout(() => {
      const tableAfter = this.pageItem?.children?.[0];
      if (!tableAfter) return;
      const sectionAfter = tableAfter.children?.find((x: PageItem) => x.tag === section) as PageItem;
      if (!sectionAfter) return;
      // انتخاب master جدید (همان top-left قبلی)
      try {
        // پس از insert ها master در همان موقعیت منطقی خواهد بود؛ سعی کن select بکنی:
        const rowsAfter = sectionAfter.children ?? [];
        const gridAfter = buildLogicalGrid(rowsAfter);
        if (gridAfter?.[rowIndex]?.[colIndex]) {
          const newMaster = gridAfter[rowIndex][colIndex].cell;
          if (newMaster) this.pb.selectBlock(newMaster);
        }
      } catch (err) {
        // ignore
      }

      this.rangeSelection = undefined;
      this.firstSelectedCell = undefined;
      this.update();
    }, 20);
  }
}
