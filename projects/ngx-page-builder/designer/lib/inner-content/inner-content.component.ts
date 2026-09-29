import {
  Component,
  ElementRef,
  OnInit,
  ChangeDetectionStrategy,
  viewChild,
  type ApplicationRef,
  DOCUMENT,
} from '@angular/core';
import { PageBuilderBaseComponent } from '../page-builder-base-component';
import { LibConsts } from 'ngx-page-builder/core';
import { createApplication } from '@angular/platform-browser';
import { BaseContentComponent } from './base-content';
import { NXG_PAGE_BUILDER_SERVICE } from 'ngx-page-builder/designer/services/page-builder.service';

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

  constructor() {
    super();
  }

  ngOnInit() {
    this.pb.cls.iframe = this.iframe().nativeElement;
    this.loadIframe();
    for (let js of LibConsts.publicJs) {
      const j = this.doc.createElement('script');
      j.src = js;
      j.id = js.split('/').pop()?.split('.').at(0) ?? 'publicJs-' + Math.random() * 10000;

      this.iframe().nativeElement?.insertBefore(j, this.iframe().nativeElement?.firstChild);
    }

    console.log('pageinfo:', this.pb.pageInfo);
  }

  async loadIframe() {
    const iframe = this.iframe()?.nativeElement;
    if (!iframe) return;

    const doc = iframe.contentDocument!;
    // clean previous data
    doc.body.innerHTML = '';
    const host = doc.createElement('ngx-page-builder-context');
    doc.body.appendChild(host);

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
          provide: NXG_PAGE_BUILDER_SERVICE,
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
