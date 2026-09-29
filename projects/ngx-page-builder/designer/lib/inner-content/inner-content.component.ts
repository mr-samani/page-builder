import {
  Component,
  ElementRef,
  OnInit,
  ChangeDetectionStrategy,
  viewChild,
  type ApplicationRef,
  DOCUMENT,
  inject,
  Injector,
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
    <iframe #iframe></iframe>
  `,
  styles: `
    iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
})
export class InnerContentComponent extends PageBuilderBaseComponent implements OnInit {
  private readonly iframe = viewChild.required<ElementRef<HTMLIFrameElement>>('iframe');
  private iframeApp?: ApplicationRef;
  protected readonly injector = inject(Injector);
  constructor() {
    super();
  }

  ngOnInit() {
    this.pb.cls.iframe = this.iframe().nativeElement;
    for (let js of LibConsts.publicJs) {
      const j = this.doc.createElement('script');
      j.src = js;
      j.id = js.split('/').pop()?.split('.').at(0) ?? 'publicJs-' + Math.random() * 10000;

      this.iframe().nativeElement?.insertBefore(j, this.iframe().nativeElement?.firstChild);
    }

    this.loadIframe();
  }

  async loadIframe() {
    const iframe = this.iframe()?.nativeElement;
    if (!iframe) return;

    const dir = this.pb.pageInfo.config.direction;
    const doc = iframe.contentDocument!;

    const style = doc.createElement('style');
    style.innerHTML = `
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
    doc.head.appendChild(style);
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
  }

  ngOnDestroy() {
    this.iframeApp?.destroy();
  }
}
