import { Injectable } from '@angular/core';
import { IPageBuilderFilePicker } from 'ngx-page-builder/designer';

@Injectable()
export class FilePickerService implements IPageBuilderFilePicker {
  baseUrlAddress: string = '';
  openFilePicker(type: 'image' | 'file'): Promise<string> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = type === 'image' ? 'image/*' : '*';
      input.onchange = (event) => {
        const target = event.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
          const file = target.files[0];
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve(e.target?.result as string);
          };
          reader.readAsDataURL(file);
        } else {
          resolve('');
        }
      };
      input.click();
    });
  }
}
