import { ChangeDetectorRef, DOCUMENT, inject } from '@angular/core';
import { PageBuilderShortcutService } from '../services/shortcut.service';
import { DynamicDataService, DynamicElementService, LibConsts, ViewMode } from 'ngx-page-builder/core';
import { PageBuilderService } from '../services/page-builder.service';

export abstract class PageBuilderBaseComponent {
  readonly dynamicElementService = inject(DynamicElementService);
  readonly pb = inject(PageBuilderService);
  readonly chdRef = inject(ChangeDetectorRef);

  readonly dynamicDataService = inject(DynamicDataService);

  readonly shortcuts = inject(PageBuilderShortcutService);
  readonly doc = inject(DOCUMENT);

  set viewMode(val: ViewMode) {
    LibConsts.viewMode = val;
  }
  get viewMode() {
    return LibConsts.viewMode;
  }
}
