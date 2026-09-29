import { ChangeDetectorRef, DOCUMENT, inject } from '@angular/core';
import { PageBuilderShortcutService } from '../services/shortcut.service';
import { DynamicDataService, DynamicElementService, LibConsts, ViewMode, WINDOW } from 'ngx-page-builder/core';
import { NXG_PAGE_BUILDER_SERVICE } from '../services/page-builder.service';

export abstract class PageBuilderBaseComponent {
  readonly dynamicElementService = inject(DynamicElementService);
  readonly pb = inject(NXG_PAGE_BUILDER_SERVICE);
  readonly chdRef = inject(ChangeDetectorRef);

  readonly dynamicDataService = inject(DynamicDataService);

  readonly shortcuts = inject(PageBuilderShortcutService);
  readonly doc = inject(DOCUMENT);
  readonly win = inject(WINDOW);

  set viewMode(val: ViewMode) {
    LibConsts.viewMode = val;
  }
  get viewMode() {
    return LibConsts.viewMode;
  }
}
