import { ChangeDetectorRef, DOCUMENT, inject } from '@angular/core';
import { PageBuilderService } from '../services/page-builder.service';
import { PageBuilderShortcutService } from '../services/shortcut.service';
import { DynamicDataService, DynamicElementService, WINDOW } from 'ngx-page-builder/core';

export abstract class PageBuilderBaseComponent {
  readonly dynamicElementService = inject(DynamicElementService);
  readonly pb = inject(PageBuilderService);
  readonly chdRef = inject(ChangeDetectorRef);

  readonly dynamicDataService = inject(DynamicDataService);

  readonly shortcuts = inject(PageBuilderShortcutService);
  readonly doc = inject(DOCUMENT);
  readonly win = inject(WINDOW);
}
