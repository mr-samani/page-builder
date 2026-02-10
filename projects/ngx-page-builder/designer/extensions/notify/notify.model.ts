import { NgxPgNotifyOptions } from './notify-options';

export type NgxPgNotifyType = 'success' | 'error' | 'warning' | 'info';
export interface NgxPgNotifyPayload {
  id: string;
  message: string;
  type: NgxPgNotifyType;
  options: NgxPgNotifyOptions;
}
