import {
  Component,
  ElementRef,
  OnInit,
  ChangeDetectionStrategy,
  viewChild,
  ApplicationRef,
  DOCUMENT,
  inject,
  Injector,
  computed,
} from '@angular/core';
import { PageBuilderBaseComponent } from '../page-builder-base-component';
import { LibConsts } from 'ngx-page-builder/core';
import { createApplication } from '@angular/platform-browser';
import { BaseContentComponent } from './base-content';
import { PageBuilderService } from 'ngx-page-builder/designer/services/page-builder.service';
import { DragDropService } from 'ngx-kit/drag-resize';

@Component({
  selector: 'inner-content',
  template: `
    <div class="canvas">
      <!-- عرض iframe برابر minWidth همان breakpoint است تا media query های همان breakpoint واقعاً فعال شوند -->
      <iframe #iframe [style.width.px]="canvasWidth()"></iframe>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .canvas {
      height: 100%;
      overflow-x: auto;
      overflow-y: hidden;
    }
    iframe {
      height: 100%;
      border: none;
      margin: 0 auto;
      display: block;
      box-shadow: 0 0 7px 0px #4f4f4f;
      transition: width 200ms ease;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
})
export class InnerContentComponent extends PageBuilderBaseComponent implements OnInit {
  private readonly iframe = viewChild.required<ElementRef<HTMLIFrameElement>>('iframe');
  private iframeApp?: ApplicationRef;
  protected readonly injector = inject(Injector);
  protected readonly canvasWidth = computed(() => this.pb.responsive().minWidth);

  constructor() {
    super();
    this.pb.onUpdateBaseConfig$.subscribe((c) => {
      if (c) this.updateBodyStyle();
    });
  }

  ngOnInit() {
    this.loadIframe();
  }

  async loadIframe() {
    const iframe = this.iframe()?.nativeElement;
    if (!iframe) return;

    const doc = iframe.contentDocument!;

    // clean previous data
    doc.body.innerHTML = '';
    const host = doc.createElement('ngx-page-builder-context');
    doc.body.appendChild(host);

    const drp = this.injector.get(DragDropService);
    // create new Angular Application Instance
    this.iframeApp = await createApplication({
      providers: [
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

    // کامپوننت Angular را داخل iframe bootstrap می‌کنیم
    this.iframeApp.bootstrap(BaseContentComponent, {
      hostElement: host,
    });
    this.pb.cls.setIframe(iframe);
    this.updateBodyStyle();
    this.loadJs();
  }

  private updateBodyStyle() {
    const iframe = this.iframe()?.nativeElement;
    if (!iframe) return;
    const doc = iframe.contentDocument!;
    const dir = this.pb.pageInfo.config.direction;
    const s = `
    body{
      margin:0;
      padding:0;
      height:100%;
      direction:${dir};
      overflow-y:scroll;
    }
    ngx-page-builder-context{
      height: 100%;
      display: block;
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
    this.iframeApp?.destroy();
  }
}
