import { ChangeDetectionStrategy, Component, effect, Injector, OnInit } from '@angular/core';
import { PageBuilderBaseComponent } from '../page-builder-base-component';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ConfigDialogComponent } from '../config-dialog/config-dialog.component';
import { SortPageListComponent } from '../sort-page-list/sort-page-list.component';
import { SvgIconDirective } from '../../directives/svg-icon.directive';
import { ImportDialogComponent } from '../import-dialog/import-dialog.component';
import { ExportHtmlService } from '../../services/import-export/export-html.service';
import { Notify } from '../../extensions/notify';
import { HistoryService } from '../../services/history.service';
import { CssFileDialogComponent } from '../css-file-dialog/css-file-dialog.component';
import { preparePageDataForSave } from '../../services/storage/prepare-page-builder-data';
import { LibConsts, PageItem, PagePreviewService } from 'ngx-page-builder/core';

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
  pageNumber: number = 1;
  enableHistory = LibConsts.enableHistory;
  toolbarConfig = LibConsts.toolbarConfig;

  constructor(
    injector: Injector,
    private matDialog: MatDialog,
    private exporter: ExportHtmlService,

    public history: HistoryService,
    private previewService: PagePreviewService
  ) {
    super(injector);
    effect(() => {
      this.pageNumber = this.pageBuilder.currentPageIndex() + 1;
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
    if (!this.pageBuilder.currentPage) {
      return;
    }
    let blocks = this.pageBuilder.currentPage.bodyItems;
    blocks = this.history.undo(blocks);
    this.pageBuilder.updatePage(blocks);
  }
  redo() {
    if (!this.pageBuilder.currentPage) {
      return;
    }
    let blocks = this.pageBuilder.currentPage.bodyItems;
    blocks = this.history.redo(blocks);
    this.pageBuilder.updatePage(blocks);
  }

  getHistory() {
    console.log(this.history.getHistory());
  }

  changePage() {
    this.pageBuilder
      .changePage(this.pageNumber)
      .then((index) => {
        this.pageNumber = index + 1;
      })
      .catch((er) => {
        this.pageNumber = this.pageBuilder.currentPageIndex() + 1;
      });
  }

  addPage() {
    this.pageBuilder.addPage().then((index) => {
      this.pageNumber = index + 1;
    });
  }

  removePage() {
    const c = confirm('Are you sure you want to remove this page?');
    if (c) {
      this.pageBuilder.removePage().then((index) => {
        this.pageNumber = index + 1;
      });
    }
  }
  nextPage() {
    this.pageBuilder
      .nextPage()
      .then((index) => {
        this.pageNumber = index + 1;
      })
      .catch(() => {});
  }
  previousPage() {
    this.pageBuilder
      .previousPage()
      .then((index) => {
        this.pageNumber = index + 1;
      })
      .catch(() => {});
  }

  onSave() {
    this.pageBuilder.save();
  }

  async onOpen() {
    await this.pageBuilder.open();
    console.log(this.pageBuilder.pageInfo, this.pageBuilder.pageInfo.pages.length);
    this.chdRef.detectChanges();
  }

  toggleOutlines() {
    this.pageBuilder.showOutlines.set(!this.pageBuilder.showOutlines());
  }
  deSelectBlock() {
    this.pageBuilder.deSelectBlock();
  }

  async print() {
    const data = await preparePageDataForSave(this.pageBuilder);
    await this.previewService.openPreview(data, 'Print');
  }
  async preview() {
    const data = await preparePageDataForSave(this.pageBuilder);
    await this.previewService.openPreview(data, 'Preview');
  }

  previewPage() {
    window.open('/preview');
  }
  sortPages() {
    this.matDialog
      .open(SortPageListComponent)
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.pageBuilder.reloadCurrentPage();
        }
      });
  }
  openConfigDialog() {
    this.matDialog
      .open(ConfigDialogComponent, {
        panelClass: 'ngx-page-builder',
      })
      .afterClosed()
      .subscribe((r) => {
        this.chdRef.detectChanges();
      });
  }
  openCssFileDialog() {
    this.matDialog
      .open(CssFileDialogComponent, {
        panelClass: 'ngx-page-builder',
        data: {
          classes: {},
        },
        width: '80vw',
        maxWidth: '100%',
      })
      .afterClosed()
      .subscribe((r) => {
        this.chdRef.detectChanges();
      });
  }
  async exportHtml() {
    const data = await preparePageDataForSave(this.pageBuilder);
    this.exporter.exportHtml(data);
  }
  importHtml() {
    const pageIndex = this.pageBuilder.currentPageIndex();
    if (pageIndex < 0) {
      Notify.error('Create page to import');
      return;
    }
    this.matDialog
      .open(ImportDialogComponent, {
        panelClass: 'ngx-page-builder',
        width: '80%',
        minWidth: '80%',
        maxWidth: '100%',
      })
      .afterClosed()
      .subscribe(async (r?: PageItem[]) => {
        if (r) {
          this.pageBuilder.pageInfo.pages[pageIndex].bodyItems.push(...r);
          r.map(async (item) => await this.pageBuilder.createBlockElement(true, item));
          this.chdRef.detectChanges();
        }
      });
  }
}
