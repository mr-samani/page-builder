import { Injectable } from '@angular/core';
import { IStorageService } from './IStorageService';
import { IPagebuilderOutput } from "ngx-page-builder/core";

@Injectable()
export class HttpStorageService implements IStorageService {
  loadData(): Promise<IPagebuilderOutput> {
    throw new Error('Method not implemented.');
  }
  saveData(): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
}
