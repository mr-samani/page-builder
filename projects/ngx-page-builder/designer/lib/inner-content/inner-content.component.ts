import {
  Component,
  ElementRef,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  viewChild,
  ApplicationRef,
  DOCUMENT,
  inject,
  Injector,
  computed,
  signal,
  effect,
  untracked,
  afterNextRender,
} from '@angular/core';
import { PageBuilderBaseComponent } from '../page-builder-base-component';
import { DynamicElementService, LibConsts } from 'ngx-page-builder/core';
import { createApplication } from '@angular/platform-browser';
import { BaseContentComponent } from './base-content';
import { PageBuilderService } from '../../services/page-builder.service';
import { DragDropService } from 'ngx-kit/drag-resize';
import { ALL_ICONS, provideIcons } from 'ngx-page-builder/icons';

const MIN_SCALE = 0.1;
const THUMB_MIN_HEIGHT = 32;

/** document خالی با doctype؛ بدون این، iframe در quirks-mode باز می‌شود و درصدها/ارتفاع‌ها با خروجی نهایی فرق می‌کنند */
const IFRAME_HTML = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>';

interface ThumbState {
  show: boolean;
  /** px (واحد بصری، یعنی بعد از scale) */
  height: number;
  y: number;
}
const HIDDEN_THUMB: ThumbState = { show: false, height: 0, y: 0 };

/**
 * Canvas صفحه‌ساز (مثل Webflow):
 *
 *  - عرض «منطقی» iframe همیشه برابر عرض breakpoint فعال است (تا media query های همان breakpoint فعال شود).
 *  - اگر جای کافی نبود، کل iframe با `transform: scale()` کوچک می‌شود تا در عرض موجود جا شود (fit)،
 *    و اگر جای اضافه بود وسط canvas قرار می‌گیرد.
 *  - ارتفاع منطقی iframe = ارتفاع موجود ÷ scale؛ در نتیجه بعد از scale دقیقاً کل ارتفاع canvas را پر می‌کند
 *    و `100vh` داخل صفحه برابر همان چیزی است که کاربر می‌بیند.
 *  - اسکرول داخل خود iframe است (مثل سایت واقعی)، ولی scrollbar بومی مخفی است (تا عرض layout دقیقاً برابر عرض breakpoint بماند
 *    و scale نشود) و به‌جایش یک scrollbar سبک و scale‌نشده بیرون از iframe رسم می‌شود.
 */
@Component({
  selector: 'inner-content',
  template: `
    <div class="canvas" #canvas>
      <div class="stage" [style.left.px]="stageLeft()" [style.width.px]="stageWidth()">
        <iframe
          #iframe
          title="Page canvas"
          [style.width.px]="deviceWidth()"
          [style.height.px]="deviceHeight()"
          [style.transform]="scaleTransform()"></iframe>

        <div
          class="vbar"
          [class.active]="thumb().show"
          [class.dragging]="dragging()"
          (pointerdown)="onTrackDown($event)"
          (click)="$event.stopPropagation()">
          <div
            class="thumb"
            [style.height.px]="thumb().height"
            [style.transform]="'translateY(' + thumb().y + 'px)'"
            (pointerdown)="onThumbDown($event)"></div>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      position: absolute;
      inset: 0;
    }
    /* canvas هیچ‌وقت اندازه‌اش را از محتوا نمی‌گیرد (contain:size)؛ این جلوی حلقه‌ی resize را می‌گیرد */
    .canvas {
      position: relative;
      height: 100%;
      overflow: hidden;
      contain: size layout style;
    }
    .stage {
      position: absolute;
      top: 0;
      bottom: 0;
      overflow: hidden;
      box-shadow: 0 0 7px 0 #4f4f4f;
      background: #fff;
    }
    iframe {
      position: absolute;
      top: 0;
      left: 0;
      display: block;
      border: 0;
      margin: 0;
      transform-origin: 0 0;
    }

    /* scrollbar سبک بیرون از iframe */
    .vbar {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: 12px;
      display: none;
      z-index: 2;
      &.active {
        display: block;
      }
      .thumb {
        position: absolute;
        top: 0;
        right: 2px;
        width: 6px;
        border-radius: 6px;
        background: rgb(120 120 120 / 0.55);
        transition:
          width 0.12s ease,
          background 0.12s ease;
        will-change: transform;
      }
      &:hover .thumb,
      &.dragging .thumb {
        width: 8px;
        background: rgb(100 100 100 / 0.85);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
})
export class InnerContentComponent extends PageBuilderBaseComponent implements OnInit, OnDestroy {
  private readonly iframe = viewChild<ElementRef<HTMLIFrameElement>>('iframe');
  private readonly canvas = viewChild<ElementRef<HTMLElement>>('canvas');

  private iframeApp?: ApplicationRef;
  protected readonly injector = inject(Injector);

  private canvasObserver?: ResizeObserver;
  private contentObserver?: ResizeObserver;
  private destroyed = false;
  private thumbRaf?: number;

  /** فضای قابل‌استفاده‌ی canvas (px واقعی صفحه) */
  private readonly available = signal({ w: 0, h: 0 });

  /** عرض منطقی دستگاه = عرض breakpoint فعال */
  protected readonly deviceWidth = computed(() => this.pb.responsive().minWidth);

  readonly scale = computed(() => {
    const w = this.available().w;
    if (w <= 0) return 1;
    return Math.max(MIN_SCALE, Math.min(1, w / this.deviceWidth()));
  });

  /** ارتفاع منطقی: بعد از scale دقیقاً ارتفاع canvas می‌شود */
  protected readonly deviceHeight = computed(() => {
    const h = this.available().h;
    return h > 0 ? Math.ceil(h / this.scale()) : 0;
  });

  protected readonly stageWidth = computed(() => {
    const { w } = this.available();
    return Math.min(w, Math.round(this.deviceWidth() * this.scale()));
  });
  protected readonly stageLeft = computed(() => Math.max(0, Math.floor((this.available().w - this.stageWidth()) / 2)));
  protected readonly scaleTransform = computed(() => `scale(${this.scale()})`);

  protected readonly thumb = signal<ThumbState>(HIDDEN_THUMB);
  protected readonly dragging = signal(false);

  constructor() {
    super();
    this.pb.onUpdateBaseConfig$.subscribe((c) => {
      if (c) this.updateBodyStyle();
    });

    // scale را به بقیه‌ی صفحه‌ساز (block-selector و ...) و CSS داخل iframe اطلاع بده
    effect(() => {
      const s = this.scale();
      untracked(() => {
        this.pb.canvasScale.set(s);
        this.syncScaleVar(s);
      });
    });

    // با عوض شدن اندازه‌ی منطقی، موقعیت scrollbar را دوباره حساب کن
    effect(() => {
      this.deviceHeight();
      this.deviceWidth();
      untracked(() => this.scheduleThumbUpdate());
    });

    afterNextRender(() => this.observeCanvas());
  }

  ngOnInit() {
    this.loadIframe();
  }

  /** برای سازگاری با کدهای قبلی (مثلاً بعد از resize پنل‌ها). حالا ResizeObserver خودش کار را می‌کند. */
  updateScale() {
    this.measureCanvas();
  }

  //---------------------------------- اندازه‌ی canvas ----------------------------------

  private observeCanvas() {
    const el = this.canvas()?.nativeElement;
    if (!el) return;
    this.measureCanvas();
    this.canvasObserver = new ResizeObserver(() => this.measureCanvas());
    this.canvasObserver.observe(el);
  }

  private measureCanvas() {
    const el = this.canvas()?.nativeElement;
    if (!el) return;
    // clientWidth/Height: بدون تأثیر transform و border
    const w = el.clientWidth;
    const h = el.clientHeight;
    const cur = this.available();
    if (cur.w !== w || cur.h !== h) this.available.set({ w, h });
  }

  //---------------------------------- iframe ----------------------------------

  async loadIframe() {
    const iframe = this.iframe()?.nativeElement;
    if (!iframe) return;

    const doc = iframe.contentDocument!;

    // document را با doctype بازنویسی می‌کنیم تا standards-mode باشد (مثل خروجی نهایی)
    doc.open();
    doc.write(IFRAME_HTML);
    doc.close();

    const host = doc.createElement('ngx-page-builder-context');
    doc.body.appendChild(host);

    const drp = this.injector.get(DragDropService);
    // create new Angular Application Instance
    const app = await createApplication({
      providers: [
        provideIcons(ALL_ICONS),
        // خیلی مهم:
        // Angular را مجبور می‌کنیم DOCUMENT را
        // همان document مربوط به iframe بداند.
        {
          provide: DOCUMENT,
          useValue: doc,
        },
        {
          provide: DragDropService,
          useValue: drp,
        },
        {
          provide: PageBuilderService,
          useValue: this.pb,
        },
      ],
    });
    if (this.destroyed) {
      app.destroy();
      return;
    }
    this.iframeApp = app;

    // بلاک‌های سفارشی باید با application ی iframe ساخته شوند تا استایل کامپوننت‌هایشان
    // داخل <head> ی iframe نوشته شود (نه document اصلی). قبل از ساخت اولین بلاک ثبت می‌شود.
    this.injector.get(DynamicElementService).registerDocument(doc, this.iframeApp.injector);

    // کامپوننت Angular را داخل iframe bootstrap می‌کنیم
    this.iframeApp.bootstrap(BaseContentComponent, {
      hostElement: host,
    });
    this.pb.cls.setIframe(iframe);
    this.updateBodyStyle();
    this.syncScaleVar(this.scale());
    this.loadJs();
    this.observeContent(iframe);
  }

  /** با تغییر محتوا/اسکرول، scrollbar بیرونی هماهنگ می‌شود */
  private observeContent(iframe: HTMLIFrameElement) {
    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;
    if (!win || !doc) return;

    doc.addEventListener('scroll', () => this.scheduleThumbUpdate(), { passive: true });

    const RO = (win as unknown as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver ?? ResizeObserver;
    this.contentObserver = new RO(() => this.scheduleThumbUpdate());
    this.contentObserver.observe(doc.body);
    this.contentObserver.observe(doc.documentElement);
    this.scheduleThumbUpdate();
  }

  private syncScaleVar(scale: number) {
    const root = this.iframe()?.nativeElement.contentDocument?.documentElement;
    root?.style.setProperty('--pb-canvas-scale', String(scale));
  }

  private updateBodyStyle() {
    const iframe = this.iframe()?.nativeElement;
    if (!iframe) return;
    const doc = iframe.contentDocument!;
    const s = `${this.siteSettingsToCss()}
    ngx-page-builder-context{
      display: block;
    }
    *{
      box-sizing:border-box;
    }
    `;

    let style = doc.head.querySelector('#ngx-page-context-base-style');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'ngx-page-context-base-style';
      doc.head.appendChild(style);
    }
    style.innerHTML = s;
  }

  private loadJs() {
    const iframe = this.iframe()?.nativeElement;
    if (!iframe) return;
    const doc = iframe.contentDocument!;

    for (let js of LibConsts.publicJs) {
      const j = this.doc.createElement('script');
      j.src = js;
      j.id = js.split('/').pop()?.split('.').at(0) ?? 'publicJs-' + Math.random() * 10000;
      doc.head.appendChild(j);
    }
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.canvasObserver?.disconnect();
    this.contentObserver?.disconnect();
    if (this.thumbRaf !== undefined) cancelAnimationFrame(this.thumbRaf);
    const doc = this.iframe()?.nativeElement.contentDocument;
    if (doc) this.injector.get(DynamicElementService).unregisterDocument(doc);
    this.iframeApp?.destroy();
  }

  siteSettingsToCss(): string {
    const s = this.pb.pageInfo.config;

    // html همان viewport ی iframe است و اسکرول روی آن انجام می‌شود (مثل صفحه‌ی واقعی).
    // scrollbar بومی عمداً مخفی است: وجودش عرض layout را از عرض breakpoint کم می‌کرد؛ جایش scrollbar بیرونی می‌آید.
    // body یک بلاک معمولی است (مثل خروجی نهایی)؛ فقط ناحیه‌ی drop حداقل یک صفحه ارتفاع دارد (base-content.scss).
    return `html {
      height: 100%;
      overflow-y: auto;
      scrollbar-width: none;
      overscroll-behavior: contain;
    }
    html::-webkit-scrollbar { display: none; }
    body {
      --pb-font-family: ${s.fontFamily};
      --pb-base-font-size: ${s.baseFontSize ?? '16px'};
      --pb-color-text: ${s.color ?? 'inherit'};
      --pb-color-background: ${s.backgroundColor ?? 'inherit'};
      color-scheme: ${s.colorScheme};
      direction: ${s.direction};
      font-family: var(--pb-font-family);
      font-size: var(--pb-base-font-size);
      color: var(--pb-color-text, inherit);
      background: var(--pb-color-background, transparent);

      margin: 0;
      padding: 0;
      min-height: 100%;
    }`;
  }

  //---------------------------------- scrollbar بیرونی ----------------------------------

  private scroller(): HTMLElement | null {
    return (this.iframe()?.nativeElement.contentDocument?.scrollingElement as HTMLElement | null) ?? null;
  }

  private scheduleThumbUpdate() {
    if (this.thumbRaf !== undefined) return;
    this.thumbRaf = requestAnimationFrame(() => {
      this.thumbRaf = undefined;
      this.updateThumb();
    });
  }

  private updateThumb() {
    const sc = this.scroller();
    const trackH = this.available().h;
    let next = HIDDEN_THUMB;

    if (sc && trackH > 0) {
      const scrollH = sc.scrollHeight;
      const clientH = sc.clientHeight;
      if (scrollH > clientH + 1) {
        const height = Math.min(trackH, Math.max(THUMB_MIN_HEIGHT, Math.round((trackH * clientH) / scrollH)));
        const maxY = trackH - height;
        const y = Math.round((sc.scrollTop / (scrollH - clientH)) * maxY);
        next = { show: true, height, y: Math.min(Math.max(0, y), maxY) };
      }
    }

    const cur = this.thumb();
    if (cur.show !== next.show || cur.height !== next.height || cur.y !== next.y) this.thumb.set(next);
  }

  protected onThumbDown(ev: PointerEvent) {
    const sc = this.scroller();
    if (!sc) return;
    ev.preventDefault();
    ev.stopPropagation();

    const el = ev.currentTarget as HTMLElement;
    el.setPointerCapture(ev.pointerId);

    const startY = ev.clientY;
    const startTop = sc.scrollTop;
    const trackH = this.available().h;
    const ratio = (sc.scrollHeight - sc.clientHeight) / Math.max(1, trackH - this.thumb().height);
    this.dragging.set(true);

    const move = (e: PointerEvent) => {
      sc.scrollTop = startTop + (e.clientY - startY) * ratio;
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      this.dragging.set(false);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  /** کلیک روی خود track (نه thumb) = یک صفحه بالا/پایین */
  protected onTrackDown(ev: PointerEvent) {
    if (ev.target !== ev.currentTarget) return;
    const sc = this.scroller();
    if (!sc) return;
    ev.preventDefault();
    const t = this.thumb();
    const rectTop = (ev.currentTarget as HTMLElement).getBoundingClientRect().top;
    const dir = ev.clientY - rectTop < t.y ? -1 : 1;
    sc.scrollBy({ top: dir * sc.clientHeight * 0.9, behavior: 'smooth' });
  }
}
