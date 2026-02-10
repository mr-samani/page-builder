export interface NgxPgNotifyOptions {
  timeout?: number; // ms, default 3000
  position?:
    | 'center'
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right'
    | 'top-center'
    | 'bottom-center';
  maxVisible?: number; // how many visible at once (default 1 -> queued, prevents overlap)
  allowHtml?: boolean; // whether message may contain HTML (default false)
  pauseOnHover?: boolean; // pause timeout when hovered
  dismissible?: boolean; // show close button
  containerClass?: string; // additional container class
  notificationClass?: string; // additional notification class
}
