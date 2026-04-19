import { Injectable } from '@angular/core';
import { IPageBuilderFilePicker } from 'ngx-page-builder/designer';

@Injectable()
export class FilePickerService implements IPageBuilderFilePicker {
  baseUrlAddress: string = '';
  openFilePicker(type: 'image' | 'file'): Promise<string> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = type === 'image' ? 'image/*' : '*';

      input.onchange = (event) => {
        const target = event.target as HTMLInputElement;
        if (!target.files?.length) return resolve(''); // خالی

        const file = target.files[0];
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err); // error handling

        reader.readAsDataURL(file);
      };

      // اگر نمی‌خواهید این `input` در DOM باشد، می‌توانید بعد از استفاده آن را حذف کنید
      input.style.display = 'none';
      document.body.appendChild(input);
      input.click();
      document.body.removeChild(input);
    });
  }
}
