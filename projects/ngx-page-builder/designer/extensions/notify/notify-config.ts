import { NgxPgNotifyOptions } from './notify-options';

export const NGX_PG_NOTIFY_DEFAULTS: Required<NgxPgNotifyOptions> = {
  timeout: 3000,
  position: 'top-center',
  maxVisible: 10,
  allowHtml: false,
  pauseOnHover: true,
  dismissible: true,
  containerClass: 'ngx-bg-notify',
  notificationClass: 'ngx-pg-notify',
};
