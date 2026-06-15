import { ChangeDetectorRef, DestroyRef, DOCUMENT, inject, Inject, Injector } from '@angular/core';
import { PageBuilderService } from '../services/page-builder.service';
import { ClassManagerService } from '../services/class-manager.service';
import { WINDOW } from 'ngx-page-builder/core';

export class BaseComponent {
  protected pb = inject(PageBuilderService);
  protected doc = inject(DOCUMENT);
  protected win = inject(WINDOW);
  protected chdRef = inject(ChangeDetectorRef);
  protected destroyRef = inject(DestroyRef);
  protected cls = inject(ClassManagerService);
  constructor(injector: Injector) {}
}
