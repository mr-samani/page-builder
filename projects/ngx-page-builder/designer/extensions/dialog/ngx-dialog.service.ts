import {
  ApplicationRef,
  ComponentRef,
  createComponent,
  EmbeddedViewRef,
  EnvironmentInjector,
  Injectable,
  Injector,
  runInInjectionContext,
  Type,
} from '@angular/core';
import { NgxDialogConfig } from './ngx-dialog-config';
import { NgxDialogRef } from './ngx-dialog-ref';
import { NgxDialogComponent } from './ngx-dialog.component';

@Injectable()
export class NgxDialogService {
  dialogComponentRefs: ComponentRef<NgxDialogComponent>[] = [];
  _defaultOptions: NgxDialogConfig | undefined;
  insertedId = 0;
  constructor(
    private appRef: ApplicationRef,
    private injector: Injector,
    private envInjector: EnvironmentInjector,
  ) {}

  public open(component: Type<any>, config?: NgxDialogConfig): NgxDialogRef {
    const dialogRef = this._open(component, config);
    return dialogRef;
  }

  private _open(component: Type<any>, config?: NgxDialogConfig): NgxDialogRef {
    config = { ...(this._defaultOptions || new NgxDialogConfig()), ...config };
    const map = new WeakMap();
    map.set(NgxDialogConfig, config);

    const dialogRef = new NgxDialogRef();
    dialogRef.id = this.insertedId;
    map.set(NgxDialogRef, dialogRef);

    const sub = dialogRef.afterClosed.subscribe(() => {
      // close the dialog
      this.removeDialogComponentFromBody(dialogRef.id);
      sub.unsubscribe();
    });

    // ✅ ساخت Injector اختصاصی با DestroyRef
    const componentInjector = Injector.create({
      providers: [NgxDialogRef],
      parent: this.envInjector,
    });

    const componentRef: ComponentRef<any> = runInInjectionContext(componentInjector, () =>
      createComponent(NgxDialogComponent, {
        elementInjector: componentInjector,
        environmentInjector: this.envInjector,
      }),
    );

    this.appRef.attachView(componentRef.hostView);

    this.appendDialogComponentToBody(componentRef, config);
    componentRef.instance.config = config;
    componentRef.instance.component = component;
    componentRef.instance.onClose.subscribe(() => {
      this.removeDialogComponentFromBody(dialogRef.id);
    });
    this.dialogComponentRefs.push(componentRef);
    this.insertedId++;
    return dialogRef;
  }

  private removeDialogComponentFromBody(index: number): void {
    if (this.dialogComponentRefs[index]) {
      this.appRef.detachView(this.dialogComponentRefs[index].hostView);
      this.dialogComponentRefs[index].destroy();
    }
  }

  private appendDialogComponentToBody(componentRef: ComponentRef<NgxDialogComponent>, config: NgxDialogConfig) {
    const domElem = (componentRef.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement;
    if (config.containerClass) {
      for (let c of config.containerClass.split(' ')) {
        if (c.trim()) domElem.classList.add(c);
      }
    }
    document.body.appendChild(domElem);
  }

  closeAll() {
    for (let i = 0; i < this.dialogComponentRefs.length; i++) {
      this.removeDialogComponentFromBody(i);
    }
  }
}
