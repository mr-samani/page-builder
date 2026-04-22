import { Type } from '@angular/core';
import { NgxDialogConfig } from './ngx-dialog-config';
import { NgxDialogService } from './ngx-dialog.service';

export class Dialog {
  private static serviceInstance: NgxDialogService | null = null;
  static _setService(svc: NgxDialogService) {
    this.serviceInstance = svc;
  }

  static open<DataType>(component: Type<any>, config: NgxDialogConfig<DataType>) {
    if (!this.serviceInstance) {
      console.warn('ngx-dialog: service not initialized. Ensure NgxDialogModule is imported.');
      return;
    }
    this.serviceInstance.open(component, config);
  }
}
