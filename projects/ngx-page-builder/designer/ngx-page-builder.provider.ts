import { makeEnvironmentProviders } from '@angular/core';
import { NGX_PAGE_BUILDER_STORAGE_SERVICE } from './services/storage/token.storage';
import { LocalStorageService } from './services/storage/local.storage.service';
import { HttpStorageService } from './services/storage/http.storage.service';
import { JsonFileStorageService } from './services/storage/jsonfile.storage.service';
import { SOURCE_ITEMS } from './sources/SOURCE_ITEMS';
import { NGX_PAGE_BUILDER_HTML_EDITOR } from './services/html-editor/token.html-editor';
import { NGX_PAGE_BUILDER_FILE_PICKER } from './services/file-picker/token.filepicker';
import { NGX_PAGE_BUILDER_EXPORT_PLUGIN_STORE } from './services/plugin/plugin.token';
import { PluginStore } from './services/plugin/plugin.store';

import {
  LibConsts,
  PAGE_BUILDER_CONFIGURATION,
  PageBuilderConfiguration,
  PageBuilderToolbarConfig,
  SourceItem,
  StorageType,
} from 'ngx-page-builder/core';

export function providePageBuilder(config: PageBuilderConfiguration) {
  LibConsts.enableHistory = config.enableHistory === true;
  LibConsts.enableAddCssFile = config.enableAddCssFile === true;
  LibConsts.enableExportAsPlugin = config.enableExportAsPlugin === true;
  LibConsts.showPlugins = config.showPlugins === true;

  if (config.publicCss && Array.isArray(config.publicCss)) {
    LibConsts.publicCss = config.publicCss;
  }
  if (config.publicJs && Array.isArray(config.publicJs)) {
    LibConsts.publicJs = config.publicJs;
  }

  if (config.toolbarConfig) {
    LibConsts.toolbarConfig = { ...new PageBuilderToolbarConfig(), ...config.toolbarConfig };
  }
  let storage: any;
  switch (config.storageType) {
    case StorageType.LocalStorage:
      storage = LocalStorageService;
      break;
    case StorageType.HttpClient:
      storage = HttpStorageService;
      break;
    case StorageType.JSONFile:
      storage = JsonFileStorageService;
      break;
    case StorageType.Custom:
    case undefined:
      storage = LocalStorageService;
      break;
    default:
      throw new Error('Invalid storage type');
  }

  if (!config.customSources || !Array.isArray(config.customSources)) {
    config.customSources = [];
  }

  LibConsts.SourceItemList = [
    ...SOURCE_ITEMS,
    ...(config.customSources ?? []).map((item: SourceItem) => new SourceItem(item, true)),
  ];
  // check duplicates
  const ids = new Set();
  for (const item of LibConsts.SourceItemList) {
    if (!item.customComponent) continue;
    if (ids.has(item.customComponent.componentKey)) {
      throw new Error(
        'NgxPageBuilder: ' +
          `Custom component has Duplicate componentKey: ${item.customComponent.componentKey}`
      );
    }
    ids.add(item.customComponent.componentKey);
  }

  return [
    {
      provide: NGX_PAGE_BUILDER_STORAGE_SERVICE,
      useClass: storage,
    },
    {
      provide: PAGE_BUILDER_CONFIGURATION,
      useValue: config,
    },
    {
      provide: NGX_PAGE_BUILDER_HTML_EDITOR,
      useValue: '',
    },
    {
      provide: NGX_PAGE_BUILDER_FILE_PICKER,
      useValue: '',
    },
    {
      provide: NGX_PAGE_BUILDER_EXPORT_PLUGIN_STORE,
      useValue: new PluginStore(),
    },
  ];
}
export function providePageBuilderEnv(cfg: PageBuilderConfiguration) {
  return makeEnvironmentProviders(providePageBuilder(cfg));
}
