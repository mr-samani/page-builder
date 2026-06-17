import { Injectable } from '@angular/core';
import { IPageBuilderFilePicker } from 'ngx-page-builder/designer';

@Injectable()
export class FilePickerService implements IPageBuilderFilePicker {
  baseUrlAddress: string = '';

  async openFilePicker(type: 'image' | 'file'): Promise<string> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = type === 'image' ? 'image/*' : '.json,application/json';
      input.style.display = 'none';

      input.addEventListener(
        'change',
        async () => {
          const file = input.files?.[0];
          if (!file) {
            resolve('');
            return;
          }

          try {
            if (type === 'image') {
              // تبدیل تصویر به Base64
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = (err) => reject(err);
              reader.readAsDataURL(file);
            } else {
              // خواندن فایل متنی/JSON
              const content = await file.text();
              resolve(content);
            }
          } catch (error) {
            reject(error);
          } finally {
            input.remove();
          }
        },
        { once: true },
      );

      // اگر کاربر پنجره انتخاب فایل را بست، هندل کردن کنسل شدن
      input.addEventListener(
        'cancel',
        () => {
          input.remove();
          resolve('');
        },
        { once: true },
      );

      document.body.appendChild(input);
      input.click();
    });
  }
}
