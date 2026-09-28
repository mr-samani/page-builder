import { ChangeDetectorRef, DOCUMENT, inject } from '@angular/core';
import { PageBuilderService } from '../services/page-builder.service';
import { PageBuilderShortcutService } from '../services/shortcut.service';
import { DynamicDataService, DynamicElementService, LibConsts, ViewMode, WINDOW } from 'ngx-page-builder/core';
import { HistoryService } from '../services/history';

export abstract class PageBuilderBaseComponent {
  readonly dynamicElementService = inject(DynamicElementService);
  readonly pb = inject(PageBuilderService);
  readonly chdRef = inject(ChangeDetectorRef);

  readonly dynamicDataService = inject(DynamicDataService);

  readonly shortcuts = inject(PageBuilderShortcutService);
  protected readonly history = inject(HistoryService);
  readonly doc = inject(DOCUMENT);
  readonly win = inject(WINDOW);

  set viewMode(val: ViewMode) {
    LibConsts.viewMode = val;
  }
  get viewMode() {
    return LibConsts.viewMode;
  }
}
