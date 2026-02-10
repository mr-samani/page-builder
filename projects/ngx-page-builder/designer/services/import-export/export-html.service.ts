import { DOCUMENT, Inject, Injectable } from '@angular/core';
import { Notify } from '../../extensions/notify';
import { IPagebuilderOutput, PagePreviewService, downloadFile } from "ngx-page-builder/core";

@Injectable()
export class ExportHtmlService {
  constructor(
    private previewService: PagePreviewService,

    @Inject(DOCUMENT) private doc: Document,
  ) {}
  async exportHtml(data: IPagebuilderOutput) {
    try {
      let html = await this.previewService.openPreview(data, 'ExportHml');
      if (html) {
        downloadFile(html, 'export.html', 'plain/text');
      } else {
        Notify.warning('No data for export!');
      }
    } catch (error) {
      console.log(error);
      Notify.error('Can not export!');
    }
  }
}
