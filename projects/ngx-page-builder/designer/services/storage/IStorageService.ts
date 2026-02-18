import { IPagebuilderOutput } from 'ngx-page-builder/core';

export interface IStorageService {
  loadData(): Promise<IPagebuilderOutput>;
  saveData(): Promise<boolean>;
}
