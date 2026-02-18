import { Injectable } from '@angular/core';
import { IPagebuilderOutput, PageBuilderConfig } from 'ngx-page-builder/core';
import { IStorageService, PageBuilderService, preparePageDataForSave } from 'ngx-page-builder/designer';
import { Notify } from 'ngx-page-builder/designer/extensions/notify';

@Injectable()
export class LocalStoreService implements IStorageService {
  constructor(private pageBuilder: PageBuilderService) {}

  async loadData(): Promise<IPagebuilderOutput> {
    try {
      const savedData = localStorage.getItem('page');
      const parsed = JSON.parse(savedData || '{}');

      return parsed;
    } catch (error) {
      Notify.error('Error load data');
      console.error('Error loading data:', error);
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
      const result = JSON.stringify(sanitized);
      localStorage.setItem('page', result);
      return true;
    } catch (error) {
      Notify.error('Error save data');
      console.error('Error saving data:', error);
      throw error;
    }
  }
}
