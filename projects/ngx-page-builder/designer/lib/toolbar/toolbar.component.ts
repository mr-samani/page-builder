import { ChangeDetectionStrategy, Component, effect, Injector, Input, OnInit } from '@angular/core';
import { PageBuilderBaseComponent } from '../page-builder-base-component';
import { FormsModule } from '@angular/forms';
import { ConfigDialogComponent } from '../config-dialog/config-dialog.component';
import { SortPageListComponent } from '../sort-page-list/sort-page-list.component';
import { SvgIconDirective } from '../../directives/svg-icon.directive';
import { ImportDialogComponent } from '../import-dialog/import-dialog.component';
import { ExportHtmlService } from '../../services/import-export/export-html.service';
import { Notify } from '../../extensions/notify';
import { HistoryService } from '../../services/history.service';
import { CssFileDialogComponent } from '../css-file-dialog/css-file-dialog.component';
import { preparePageDataForSave } from '../../helper/prepare-page-builder-data';
import {
  LibConsts,
  PageItem,
  PagePreviewService,
  CustomToolbarButtons,
  LOCAL_STORAGE_SHOW_OUTLINE_KEY,
} from 'ngx-page-builder/core';
import { PreviewDialogComponent } from '../preview-dialog/preview-dialog.component';
import { Dialog } from '../../extensions/dialog';
@Component({
  selector: 'toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss'],
  standalone: true,
  imports: [FormsModule, SvgIconDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ExportHtmlService],
})
export class ToolbarComponent extends PageBuilderBaseComponent implements OnInit {
  @Input() customToolbarButtons: CustomToolbarButtons[] = [];
  pageNumber: number = 1;
  enableHistory = LibConsts.enableHistory;
  toolbarConfig = LibConsts.toolbarConfig;

  constructor(
    private exporter: ExportHtmlService,

    public history: HistoryService,
    private previewService: PagePreviewService,
  ) {
    super();
    effect(() => {
      this.pageNumber = this.pb.currentPageIndex() + 1;
      this.chdRef.detectChanges();
    });
  }

  ngOnInit() {
    // console.log('LibConsts', LibConsts);
  }

  get canUndo(): boolean {
    return this.history.canUndo();
  }
  get canRedo(): boolean {
    return this.history.canRedo();
  }
  undo() {
    if (!this.pb.currentPage) {
      return;
    }
    let blocks = this.pb.currentPage.bodyItems;
    blocks = this.history.undo(blocks);
    this.pb.updatePage(blocks);
  }
  redo() {
    if (!this.pb.currentPage) {
      return;
    }
    let blocks = this.pb.currentPage.bodyItems;
    blocks = this.history.redo(blocks);
    this.pb.updatePage(blocks);
  }

  getHistory() {
    console.log(this.history.getHistory());
  }

  changePage() {
    this.pb
      .changePage(this.pageNumber)
      .then((index) => {
        this.pageNumber = index + 1;
      })
      .catch((er) => {
        this.pageNumber = this.pb.currentPageIndex() + 1;
      });
  }

  addPage() {
    this.pb.addPage().then((index) => {
      this.pageNumber = index + 1;
    });
  }

  removePage() {
    const c = confirm('Are you sure you want to remove this page?');
    if (c) {
      this.pb.removePage().then((index) => {
        this.pageNumber = index + 1;
      });
    }
  }
  nextPage() {
    this.pb
      .nextPage()
      .then((index) => {
        this.pageNumber = index + 1;
      })
      .catch(() => {});
  }
  previousPage() {
    this.pb
      .previousPage()
      .then((index) => {
        this.pageNumber = index + 1;
      })
      .catch(() => {});
  }

  onSave() {
    this.pb.save();
  }

  async onOpen() {
    await this.pb.open();
    console.log(this.pb.pageInfo, this.pb.pageInfo.pages.length);
    this.chdRef.detectChanges();
  }

  toggleOutlines() {
    this.pb.showOutlines.set(!this.pb.showOutlines());
    localStorage.setItem(LOCAL_STORAGE_SHOW_OUTLINE_KEY, this.pb.showOutlines() + '');
  }
  deSelectBlock() {
    this.pb.deSelectBlock();
  }

  async print() {
    const data = await preparePageDataForSave(this.pb);
    await this.previewService.openPreview(data, 'Print');
  }
  async preview() {
    const data = await preparePageDataForSave(this.pb);
    Dialog.open(PreviewDialogComponent, {
      data: {
        data,
        dynamicData: this.dynamicDataService.dynamicData,
        viewMode: this.viewMode,
      },
      width: '95%',
      maxWidth: '100%',
    });
    // await this.previewService.openPreview(data, 'Preview');
  }

  previewPage() {
    this.win?.open('/preview');
  }
  sortPages() {
    Dialog.open(SortPageListComponent).afterClosed.subscribe((result) => {
      if (result) {
        this.pb.reloadCurrentPage();
      }
    });
  }
  openConfigDialog() {
    Dialog.open(ConfigDialogComponent, {
      width: '768px',
    }).afterClosed.subscribe((r) => {
      this.chdRef.detectChanges();
    });
  }
  openCssFileDialog() {
    Dialog.open(CssFileDialogComponent, {
      data: {
        classes: {},
      },
      width: '80vw',
      maxWidth: '100%',
    }).afterClosed.subscribe((r) => {
      this.chdRef.detectChanges();
    });
  }

  async exportHtml() {
    const data = await preparePageDataForSave(this.pb);
    this.exporter.exportHtml(data);
  }
  importHtml() {
    const pageIndex = this.pb.currentPageIndex();
    if (pageIndex < 0) {
      Notify.error('Create page to import');
      return;
    }
    Dialog.open(ImportDialogComponent, {
      width: '80%',
      minWidth: '80%',
      maxWidth: '100%',
    }).afterClosed.subscribe(async (r?: PageItem[]) => {
      if (r) {
        this.pb.pageInfo.pages[pageIndex].bodyItems.push(...r);
        r.map(async (item) => await this.pb.createBlockElement(true, item));
        this.chdRef.detectChanges();
      }
    });
  }
}
