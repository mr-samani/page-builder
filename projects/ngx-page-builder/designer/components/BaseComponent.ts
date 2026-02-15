import { ChangeDetectorRef, DestroyRef, DOCUMENT, inject, Inject, Injector } from '@angular/core';
import { PageBuilderService } from '../services/page-builder.service';
import { ClassManagerService } from '../services/class-manager.service';

export class BaseComponent {
  protected pageBuilder = inject(PageBuilderService);
  protected doc = inject(DOCUMENT);
  protected chdRef = inject(ChangeDetectorRef);
  protected destroyRef = inject(DestroyRef);
  protected cls = inject(ClassManagerService);
  constructor(injector: Injector) {}
}
