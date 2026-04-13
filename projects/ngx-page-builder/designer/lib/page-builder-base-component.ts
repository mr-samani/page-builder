import { ChangeDetectorRef, inject, Injector } from '@angular/core';
import { PageBuilderService } from '../services/page-builder.service';
import { PageBuilderShortcutService } from '../services/shortcut.service';
import { DynamicDataService, DynamicElementService, LibConsts, ViewMode } from 'ngx-page-builder/core';

export abstract class PageBuilderBaseComponent {
  readonly dynamicElementService = inject(DynamicElementService);
  readonly pb = inject(PageBuilderService);
  readonly chdRef = inject(ChangeDetectorRef);

  readonly dynamicDataService = inject(DynamicDataService);

  readonly shortcuts = inject(PageBuilderShortcutService);

  constructor(injector: Injector) {}

  set viewMode(val: ViewMode) {
    LibConsts.viewMode = val;
  }
  get viewMode() {
    return LibConsts.viewMode;
  }
}
