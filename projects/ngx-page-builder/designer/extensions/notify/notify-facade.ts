import { NgxPgNotifyOptions } from './notify-options';
import { NgxPgNotifyService } from './notify.service';

/**
 * Static facade so call sites can use: Notify.warn('msg', opts)
 * Module will set the service instance in its constructor.
 */
export class Notify {
  private static serviceInstance: NgxPgNotifyService | null = null;

  static _setService(svc: NgxPgNotifyService) {
    this.serviceInstance = svc;
  }

  static show(
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    options?: NgxPgNotifyOptions,
  ) {
    if (!this.serviceInstance) {
      console.warn('ngx-pg-notify: service not initialized. Ensure NgxPgNotifyModule is imported.');
      return;
    }
    this.serviceInstance.show(message, type, options);
  }

  static info(message: string, options?: NgxPgNotifyOptions) {
    this.show(message, 'info', options);
  }
  static success(message: string, options?: NgxPgNotifyOptions) {
    this.show(message, 'success', options);
  }
  static warning(message: string, options?: NgxPgNotifyOptions) {
    this.show(message, 'warning', options);
  }
  static error(message: string, options?: NgxPgNotifyOptions) {
    this.show(message, 'error', options);
  }
}
