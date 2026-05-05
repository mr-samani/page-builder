import { Injectable } from '@angular/core';
import { PageBuilderService } from '../page-builder.service';
import { IStorageService } from './IStorageService';
import { preparePageDataForSave } from '../../helper/prepare-page-builder-data';

import { IPagebuilderOutput, LOCAL_STORAGE_SAVE_KEY, PageBuilderConfig, PageBuilderDto } from 'ngx-page-builder/core';
import { ClassManagerService } from '../class-manager.service';

@Injectable()
export class LocalStorageService implements IStorageService {
  constructor(
    private pb: PageBuilderService,
    private cls: ClassManagerService,
  ) {}
  loadData() {
    return new Promise<IPagebuilderOutput>(async (resolve, reject) => {
      try {
        const pageDto = localStorage.getItem(LOCAL_STORAGE_SAVE_KEY) || '';
        if (pageDto == '') {
          resolve({
            config: new PageBuilderConfig(),
            data: [],
            styles: [],
            cssVariables: [],
          });
          return;
        }
        const parsed: PageBuilderDto = new PageBuilderDto(JSON.parse(pageDto));
        const styles = await this.cls.exportAllFileCSS();
        resolve({
          config: parsed.config,
          data: parsed.pages,
          styles,
          cssVariables: this.cls.cssVariables,
        });
      } catch (error) {
        console.error('Error loading page data:', error);
        reject(error);
      }
    });
  }

  saveData() {
    return new Promise<boolean>(async (resolve, reject) => {
      const sanitized = await preparePageDataForSave(this.pb);
      localStorage.setItem(LOCAL_STORAGE_SAVE_KEY, JSON.stringify(sanitized));
      resolve(true);
    });
  }
}
