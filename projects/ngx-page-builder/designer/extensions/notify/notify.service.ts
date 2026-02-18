import { Injectable, ComponentRef, ApplicationRef, Injector, Inject, DOCUMENT, inject } from '@angular/core';
import { NGX_PG_NOTIFY_DEFAULTS } from './notify-config';
import { NgxPgNotifyOptions } from './notify-options';
import { NgxPgNotifyPayload, NgxPgNotifyType } from './notify.model';

// We'll include a tiny inline uuid fallback if uuid package is not available
function makeId() {
  // simple random id
  return 'n_' + Math.random().toString(36).substr(2, 9);
}

@Injectable({ providedIn: 'root' })
export class NgxPgNotifyService {
  private queue: NgxPgNotifyPayload[] = [];
  private visible: { ref: ComponentRef<any>; payload: NgxPgNotifyPayload }[] = [];
  private container: HTMLElement | null = null;

  private doc = inject(DOCUMENT);
  constructor(
    private appRef: ApplicationRef,
    private injector: Injector,
  ) {
    // global event listeners for notifications finishing or close
    window.addEventListener('ngx-pg-notify:finish', (e: any) => this.onNotificationFinish(e.detail.id));
    window.addEventListener('ngx-pg-notify:close', (e: any) => this.onNotificationClose(e.detail.id));
  }

  configureContainer(position: NgxPgNotifyOptions['position'], containerClass: string) {
    if (this.container) return; // created already

    const container = this.doc.createElement('div');
    container.className = containerClass + ' ngx-pg-notify-container ' + `ngx-pg-pos-${position}`;
    container.style.position = 'fixed';
    container.style.zIndex = '99999';

    // center special
    if (position === 'center') {
      container.style.left = '50%';
      container.style.top = '50%';
      container.style.transform = 'translate(-50%,-50%)';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.alignItems = 'center';
      container.style.pointerEvents = 'none';
    } else {
      if (position?.includes('center')) {
        container.style.left = '50%';
        container.style.transform = 'translateX(-50%)';
      }
      // corners
      if (position?.includes('top')) container.style.top = '20px';
      else container.style.bottom = '20px';
      if (position?.includes('left')) container.style.left = '20px';
      else container.style.right = '20px';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      if (position?.includes('bottom')) container.style.flexDirection = 'column-reverse';
      container.style.pointerEvents = 'none';
    }

    this.doc.body.appendChild(container);
    this.container = container;
  }

  show(message: string, type: NgxPgNotifyType = 'info', options?: NgxPgNotifyOptions) {
    const opts: NgxPgNotifyOptions = { ...(NGX_PG_NOTIFY_DEFAULTS as any), ...(options || {}) };
    const id =
      typeof (window as any).crypto?.randomUUID === 'function' ? (window as any).crypto.randomUUID() : makeId();

    const payload: NgxPgNotifyPayload = { id, message, type, options: opts };

    this.configureContainer(opts.position!, opts.containerClass!);

    // queue or show immediately
    if (this.visible.length >= opts.maxVisible!) {
      this.queue.push(payload);
    } else {
      this._createAndShow(payload);
    }
  }

  private _createAndShow(payload: NgxPgNotifyPayload) {
    if (!this.container) this.configureContainer(payload.options.position!, payload.options.containerClass!);
    // create DOM node wrapper for pointer events handling
    const wrapper = this.doc.createElement('div');
    wrapper.style.pointerEvents = 'auto';
    wrapper.setAttribute('data-id', payload.id);

    // create component dynamically
    // To keep things simple without ComponentFactoryResolver we create a simple DOM structure and use the NotificationComponent's markup style
    // But to honor Angular's change detection and lifecycle we should actually create an Angular component.

    // create a host element and append
    wrapper.className = 'ngx-pg-notify ' + (payload.options.notificationClass || 'ngx-pg-notify');
    wrapper.setAttribute('data-id', payload.id);
    // add type class as well
    wrapper.classList.add(`${payload.options.notificationClass || 'ngx-pg-notify'}-${payload.type}`);

    // inner HTML (safe or escaped)
    if (payload.options.allowHtml) wrapper.innerHTML = payload.message;
    else wrapper.innerText = payload.message;

    // add close button
    if (payload.options.dismissible) {
      const btn = this.doc.createElement('button');
      btn.className = 'ngx-pg-close';
      btn.innerText = '×';
      btn.style.position = 'absolute';
      btn.style.right = '8px';
      btn.style.top = '6px';
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.removeById(payload.id);
      });
      wrapper.appendChild(btn);
    } // style wrapper to match CSS expectations
    wrapper.style.minWidth = '240px';
    wrapper.style.maxWidth = '500px';
    wrapper.style.maxWidth = '100%';
    wrapper.style.padding = '14px 18px';
    wrapper.style.borderRadius = '8px';
    wrapper.style.boxShadow = '0 10px 30px rgba(0,0,0,0.08)';
    wrapper.style.margin = '8px 0';
    wrapper.style.position = 'relative';
    wrapper.style.transition = 'opacity .28s ease, transform .28s ease';
    wrapper.style.opacity = '0';
    wrapper.style.transform = 'translateY(-8px)';

    // color styles for types
    switch (payload.type) {
      case 'info':
        wrapper.style.background = '#e8f3ff';
        wrapper.style.color = '#0b63a8';
        break;
      case 'success':
        wrapper.style.background = '#e9f9f0';
        wrapper.style.color = '#0b7a3a';
        break;
      case 'warning':
        wrapper.style.background = '#fff4e5';
        wrapper.style.color = '#a36a00';
        break;
      case 'error':
        wrapper.style.background = '#ffecec';
        wrapper.style.color = '#b00020';
        break;
    }

    this.container!.appendChild(wrapper);

    // show animation
    requestAnimationFrame(() => {
      wrapper.style.opacity = '1';
      wrapper.style.transform = 'translateY(0)';
    });

    // pause on hover
    let timeoutId: any = null;
    let remaining = payload.options.timeout!;
    let endTs = Date.now() + remaining;
    const startTimer = (ms: number) => {
      timeoutId = setTimeout(() => {
        this.removeNode(wrapper, payload.id);
      }, ms);
      endTs = Date.now() + ms;
    };
    const pause = () => {
      if (!payload.options.pauseOnHover) return;
      if (!timeoutId) return;
      clearTimeout(timeoutId);
      remaining = Math.max(0, endTs - Date.now());
    };
    const resume = () => {
      if (!payload.options.pauseOnHover) return;
      if (remaining <= 0) return;
      startTimer(remaining);
    };

    wrapper.addEventListener('mouseenter', pause);
    wrapper.addEventListener('mouseleave', resume);

    // start timer
    if (payload.options.timeout && payload.options.timeout > 0) startTimer(payload.options.timeout);

    // store visible
    this.visible.push({ ref: null as any, payload });
  }
  private removeNode(node: HTMLElement, id: string) {
    node.style.opacity = '0';
    node.style.transform = 'translateY(-8px)';
    setTimeout(() => {
      try {
        node.remove();
      } catch (e) {}
      this.visible = this.visible.filter((v) => v.payload.id !== id);
      // show next in queue
      this._showNextIfPossible();
    }, 300);
  }

  private removeById(id: string) {
    // find node
    const node = this.container?.querySelector(`[data-id="${id}"]`) as HTMLElement | null;
    if (node) this.removeNode(node, id);
    else {
      // if in queue remove it
      this.queue = this.queue.filter((q) => q.id !== id);
    }
  }

  private onNotificationFinish(id: string) {
    this.removeById(id);
  }
  private onNotificationClose(id: string) {
    this.removeById(id);
  }

  private _showNextIfPossible() {
    if (!this.queue.length) return;
    const next = this.queue.shift()!;
    // ensure we don't exceed maxVisible
    if (this.visible.length < next.options.maxVisible!) {
      this._createAndShow(next);
    } else {
      // push back
      this.queue.unshift(next);
    }
  }
}
