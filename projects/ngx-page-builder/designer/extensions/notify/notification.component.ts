import { Component, OnInit, OnDestroy, Input, ChangeDetectorRef, Inject, DOCUMENT, inject } from '@angular/core';
import { NgxPgNotifyPayload } from './notify.model';

@Component({
  selector: 'ngx-pg-notification',
  template: `
    <div
      class="{{ containerClass }} {{ containerClass }}-{{ payload.type }}"
      role="status"
      (mouseenter)="onMouseEnter()"
      (mouseleave)="onMouseLeave()"
      [attr.aria-live]="payload.type === 'error' || payload.type === 'warning' ? 'assertive' : 'polite'"
      [innerHTML]="safeMessage">
      @if (options.dismissible) {
        <button class="ngx-pg-close" (click)="close($event)" aria-label="close">×</button>
      }
    </div>
  `,
})
export class NgxPgNotificationComponent implements OnInit, OnDestroy {
  @Input() payload!: NgxPgNotifyPayload;
  @Input() containerClass = 'ngx-bg-notify';

  options = this.payload?.options ?? ({} as any);

  private _timeoutId: any = null;
  private _remaining = 0;
  private _endTs = 0;
  private _paused = false;

  safeMessage = '';

  private doc = inject(DOCUMENT);
  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.options = { ...(this.payload.options || {}) };
    // decide how to render message
    if (this.options.allowHtml) {
      this.safeMessage = this.payload.message;
    } else {
      this.safeMessage = this.escapeHtml(this.payload.message);
    }

    // attach show class on next tick for animation
    setTimeout(() => {
      const el = (this as any).hostElement ?? null;
      const root = (this as any).elementRef?.nativeElement ?? null;
      // we just rely on host element's DOM node
      const host = (this as any)._host || null;
      // simpler: add class via DOM
      const native: HTMLElement | null = (this as any).elementRef ? (this as any).elementRef.nativeElement : null;
      try {
        (this as any).rootEl = this.doc.querySelector(`.ngx-pg-notify[data-id=\"${this.payload.id}\"]`);
      } catch (e) {}
      this.addShowClass();
    }, 10);

    if (this.options.timeout && this.options.timeout > 0) {
      this.startTimer(this.options.timeout);
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  // Public API to start timer (used by service when created)
  startTimer(ms: number) {
    this.clearTimer();
    this._remaining = ms;
    this._endTs = Date.now() + ms;
    this._timeoutId = setTimeout(() => this.finish(), ms);
  }
  pauseTimer() {
    if (!this._timeoutId) return;
    this._paused = true;
    clearTimeout(this._timeoutId);
    this._remaining = Math.max(0, this._endTs - Date.now());
  }

  resumeTimer() {
    if (!this._paused || this._remaining <= 0) return;
    this._paused = false;
    this.startTimer(this._remaining);
  }

  finish() {
    // dispatch custom event for service to remove
    const ev = new CustomEvent('ngx-pg-notify:finish', { detail: { id: this.payload.id } });
    window.dispatchEvent(ev);
  }

  close(ev?: Event) {
    if (ev) ev.stopPropagation();
    const evn = new CustomEvent('ngx-pg-notify:close', { detail: { id: this.payload.id } });
    window.dispatchEvent(evn);
  }

  onMouseEnter() {
    if (this.options.pauseOnHover) this.pauseTimer();
  }
  onMouseLeave() {
    if (this.options.pauseOnHover) this.resumeTimer();
  }

  addShowClass() {
    try {
      const el = this.doc.querySelector(`.ngx-pg-notify[data-id="${this.payload.id}"]`);
      if (el) el.classList.add('ngx-pg-show');
    } catch (e) {}
  }

  escapeHtml(input: string) {
    const div = this.doc.createElement('div');
    div.appendChild(this.doc.createTextNode(input));
    return div.innerHTML;
  }

  ngOnDestroyCleanup() {
    this.clearTimer();
  }

  private clearTimer() {
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }
  }
}
