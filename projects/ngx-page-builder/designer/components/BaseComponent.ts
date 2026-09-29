import { ChangeDetectorRef, DestroyRef, DOCUMENT, inject, Inject, Injector } from '@angular/core';
import { NXG_PAGE_BUILDER_SERVICE } from '../services/page-builder.service';
import { ClassManagerService } from '../services/class-manager.service';
import { WINDOW } from 'ngx-page-builder/core';

export class BaseComponent {
  protected pb = inject(NXG_PAGE_BUILDER_SERVICE);
  protected doc = inject(DOCUMENT);
  protected win = inject(WINDOW);
  protected chdRef = inject(ChangeDetectorRef);
  protected destroyRef = inject(DestroyRef);
  protected cls = inject(ClassManagerService);
  constructor(injector: Injector) {}
}
