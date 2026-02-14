import { makeEnvironmentProviders } from '@angular/core';

import {
  LibConsts,
  PAGE_PREVIEW_CONFIGURATION,
  PagePreviewConfiguration,
  SourceItem,
} from 'ngx-page-builder/core';
import { PREVIEW_SOURCE_ITEMS } from './sources/SOURCE_ITEMS';

export function providePagePreview(config: PagePreviewConfiguration) {
  if (config.publicCss && Array.isArray(config.publicCss)) {
    LibConsts.publicCss = config.publicCss;
  }
  if (config.publicJs && Array.isArray(config.publicJs)) {
    LibConsts.publicJs = config.publicJs;
  }

  if (!config.customSources || !Array.isArray(config.customSources)) {
    config.customSources = [];
  }

  LibConsts.SourceItemList = [
    ...PREVIEW_SOURCE_ITEMS,
    ...(config.customSources ?? []).map((item: SourceItem) => new SourceItem(item)),
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

  return {
    provide: PAGE_PREVIEW_CONFIGURATION,
    useValue: config,
  };
}

export function providePagePreviewEnv(cfg: PagePreviewConfiguration) {
  return makeEnvironmentProviders([providePagePreview(cfg)]);
}
