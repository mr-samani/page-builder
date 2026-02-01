import { ChangeDetectorRef, Component, DOCUMENT, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ImportHtmlService } from '../../services/import-export/import-html.service';
import { ImportResult } from '../../services/import-export/ImportResult';
import { ImportOptions } from '../../services/import-export/ImportOptions';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PreviewImportTreeComponent } from './preview-import-tree/preview-import-tree.component';
import { SvgIconDirective } from '../../directives/svg-icon.directive';
import { Notify } from '../../extensions/notify';
import { MatAnchor } from '@angular/material/button';
import { TabGroupModule } from '../../controls/tab-group/tab-group.module';
import { LoadingComponent } from '../../controls/loading/loading.component';
import { LibConsts } from '../../consts/defauls';

@Component({
  selector: 'app-import-dialog',
  templateUrl: './import-dialog.component.html',
  styleUrls: ['./import-dialog.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    PreviewImportTreeComponent,
    SvgIconDirective,
    MatAnchor,
    TabGroupModule,
    LoadingComponent,
  ],
  providers: [ImportHtmlService],
})
export class ImportDialogComponent implements OnInit {
  urlInput = '';
  querySelectorInput = '';
  htmlInput = '';
  result?: ImportResult;

  // تنظیمات پیشرفته
  importOptions: ImportOptions = {
    preserveInlineStyles: true,
    extractComputedStyles: true,
    spaWaitTime: 20000,
  };

  showBackendapiCheckbox = LibConsts.backendProxyImportUrl != '';
  useBackendApi = false;

  loading: boolean = false;
  constructor(
    private dialogRef: MatDialogRef<ImportDialogComponent>,
    @Inject(MAT_DIALOG_DATA) _data: any,
    private importer: ImportHtmlService,
    private chdr: ChangeDetectorRef,
    @Inject(DOCUMENT) private doc: Document,
  ) {}

  ngOnInit() {}
  ngAfterViewInit(): void {
    // fix bug for show colors in tinymce editor
    this.doc.querySelector('.cdk-overlay-popover')?.removeAttribute('popover');
  }

  importFromUrl(resultSection: HTMLElement) {
    if (!this.urlInput || !this.querySelectorInput) {
      Notify.warning('لطفاً URL و Query Selector را وارد کنید');
      return;
    }
    this.result = undefined;
    this.loading = true;

    let api = this.importer.importFromUrl(
      this.urlInput,
      this.querySelectorInput,
      this.importOptions,
    );
    if (this.useBackendApi) {
      api = this.importer.importFromUrlWithBackend(
        this.urlInput,
        this.querySelectorInput,
        LibConsts.backendProxyImportUrl,
        this.importOptions,
      );
    }

    api
      .finally(() => (this.loading = false))
      .then((result) => {
        this.result = result;
        Notify.success('Import successfully');
        setTimeout(() => {
          resultSection.scrollIntoView();
        }, 100);
        this.chdr.detectChanges();
      });
  }

  async importFromHtml(resultSection: HTMLElement) {
    if (!this.htmlInput) {
      Notify.warning('لطفاً محتوای HTML را وارد کنید');
      return;
    }
    this.result = undefined;
    this.loading = true;
    this.importer
      .importFromHtml(this.htmlInput, this.querySelectorInput, this.importOptions)
      .finally(() => (this.loading = false))
      .then((result) => {
        this.result = result;
        Notify.success('Import successfully');
        setTimeout(() => {
          resultSection.scrollIntoView();
        }, 100);
        this.chdr.detectChanges();
      });
  }

  ok() {
    if (this.loading || !this.result || !this.result.data) return;
    this.dialogRef.close(this.result.data);
  }
}
