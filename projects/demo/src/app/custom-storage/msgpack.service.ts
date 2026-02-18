import { Injectable } from '@angular/core';
import { IPagebuilderOutput, PageBuilderConfig } from 'ngx-page-builder/core';
import { IStorageService, PageBuilderService, preparePageDataForSave } from 'ngx-page-builder/designer';
import { encode, decode } from 'msgpack-lite';

@Injectable()
export class MessagePackStorageService implements IStorageService {
  constructor(private pageBuilder: PageBuilderService) {}

  async loadData(): Promise<IPagebuilderOutput> {
    try {
      const file = await this.selectFile(['.msgpack']);
      const buffer = await file.arrayBuffer();
      const parsed = decode(new Uint8Array(buffer));
      return parsed;
    } catch (error) {
      console.error('Error loading MessagePack file:', error);
      return {
        config: new PageBuilderConfig(),
        data: [],
        styles: [],
      };
    }
  }

  async saveData(): Promise<boolean> {
    try {
      const sanitized = await preparePageDataForSave(this.pageBuilder);
      const encoded = encode(sanitized);
      this.downloadFile(encoded, 'page-data.msgpack', 'application/octet-stream');
      return true;
    } catch (error) {
      console.error('Error saving MessagePack file:', error);
      throw error;
    }
  }

  // --- Helpers ---
  private selectFile(accept: string[]): Promise<File> {
    return new Promise((resolve, reject) => {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept.join(',');
        input.style.display = 'none';
        document.body.appendChild(input);
        input.click();

        input.onchange = () => {
          if (input.files && input.files.length > 0) resolve(input.files[0]);
          else reject('No file selected');
          document.body.removeChild(input);
        };

        input.onerror = (e) => {
          reject(e);
          document.body.removeChild(input);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private downloadFile(content: ArrayBuffer | Uint8Array, fileName: string, mimeType: string) {
    const blob = new Blob([content as any], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
}
