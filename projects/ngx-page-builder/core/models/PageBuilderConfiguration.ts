import { CMSPage } from './CMSPage';
import { SourceItem } from './SourceItem';
import { StorageType } from './storage-type';
export class PageBuilderConfiguration {
  storageType?: StorageType = StorageType.LocalStorage;
  customSources?: SourceItem[];

  enableHistory?: boolean = false;

  toolbarConfig?: PageBuilderToolbarConfig;
  enableAddCssFile?: boolean = false;
  enableExportAsPlugin?: boolean = false;
  canDeletePlugin?: boolean = false;
  showPlugins?: boolean = false;

  publicCss?: string[] = [];
  publicJs?: string[] = [];
}

export class PageBuilderToolbarConfig {
  showOpenButton?: boolean = false;
  showSaveButton?: boolean = false;
  showPreviewButton?: boolean = true;
  showPrintButton?: boolean = true;
  showConfigButton?: boolean = true;
  showImportHtmlButton?: boolean = true;
  showExportHtmlButton?: boolean = true;
}
