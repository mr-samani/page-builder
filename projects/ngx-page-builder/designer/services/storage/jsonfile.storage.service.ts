import { Injectable } from '@angular/core';
import { IStorageService } from './IStorageService';
import { PageBuilderService } from '../page-builder.service';
import { preparePageDataForSave } from '../../helper/prepare-page-builder-data';
import { FileSelectionError, FileSelectionException, FileSelector } from '../../helper/FileSelector';
import { IPagebuilderOutput, PageBuilderDto, downloadFile } from 'ngx-page-builder/core';
import { ClassManagerService } from '../class-manager.service';

@Injectable()
export class JsonFileStorageService implements IStorageService {
  constructor(
    private pb: PageBuilderService,
    private cls: ClassManagerService,
  ) {}

  async loadData(): Promise<IPagebuilderOutput> {
    return new Promise<IPagebuilderOutput>(async (resolve, reject) => {
      try {
        const file = await FileSelector.selectFile({
          accept: ['application/json', '.json'],
        });
        const text = await file.text();
        const parsed: PageBuilderDto = new PageBuilderDto(JSON.parse(text));
        const styles = await this.cls.exportAllFileCSS();
        resolve({
          config: parsed.config,
          data: parsed.pages,
          styles,
          cssVariables: this.pb.cssVariables,
        });
      } catch (error) {
        if (error instanceof FileSelectionException) {
          switch (error.code) {
            case FileSelectionError.USER_CANCELLED:
              console.log('User cancelled');
              break;
            case FileSelectionError.NO_USER_ACTIVATION:
            case FileSelectionError.BROWSER_BLOCKED:
              console.error('Browser blocked file dialog');
              break;
            default:
              console.error('File selection error:', error);
              break;
          }
        }
        reject(error);
      }
    });
  }

  async saveData(): Promise<boolean> {
    try {
      const sanitized = await preparePageDataForSave(this.pb);
      const json = JSON.stringify(sanitized, null, 2);
      downloadFile(json, 'page-data.json', 'application/json');
      return true;
    } catch (error) {
      console.error('Error saving JSON file:', error);
      throw error;
    }
  }
}
