import { Injectable } from '@angular/core';
import { IPageBuilderHtmlEditor } from 'ngx-page-builder/designer';
import { HtmlEditorComponent } from '../html-editor/html-editor.component';
import { Dialog } from 'ngx-page-builder/designer/extensions/dialog';

@Injectable()
export class HtmlEditorService implements IPageBuilderHtmlEditor {
  constructor() {}
  openEditor(content: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      Dialog.open(HtmlEditorComponent, {
        data: content,
        width: '85%',
        maxWidth: '100%',
        height: '80vh',
      }).afterClosed.subscribe((c) => {
        if (c != undefined) {
          resolve(c);
        } else {
          reject('cancel');
        }
      });
    });
  }
}
