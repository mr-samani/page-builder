import { InjectionToken } from '@angular/core';
import { IStorageService } from './IStorageService';

export const NGX_PAGE_BUILDER_STORAGE_SERVICE = new InjectionToken<IStorageService>(
  'StorageService',
);
