import { inject, Injectable } from '@angular/core';
import { IPageBuilderHtmlEditor } from 'ngx-page-builder/designer';
import { HtmlEditorComponent } from '../html-editor/html-editor.component';
import { NgxDialogService } from 'ngx-kit/dialog';

@Injectable()
export class HtmlEditorService implements IPageBuilderHtmlEditor {
  protected readonly dialog = inject(NgxDialogService);
  constructor() {}
  openEditor(content: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.dialog
        .open(HtmlEditorComponent, {
          data: content,
          width: '85%',
          maxWidth: '100%',
          height: '80vh',
        })
        .afterClosed.subscribe((c) => {
          if (c != undefined) {
            resolve(c);
          } else {
            reject('cancel');
          }
        });
    });
  }
}
