import { Renderer2, Inject, DOCUMENT, Injectable, RendererFactory2 } from '@angular/core';
import { DynamicDataService } from './dynamic-data.service';
import { DynamicElementService } from './dynamic-element.service';
import { LibConsts } from '../consts/defauls';
import { waitForFontsToLoad, waitForRenderComplete } from '../utiles/rendering';
import { Notify } from '../extensions/notify';
import { PageItem } from '../models/PageItem';
import { IPagebuilderOutput } from '../contracts/IPageBuilderOutput';
import { IPageItem } from '../contracts/IPageItem';
import { Page } from '../models/Page';

@Injectable({ providedIn: 'root' })
export class PagePreviewService {
  containerClassName = '';
  pageContainer?: HTMLElement;
  _data?: IPagebuilderOutput;
  set data(val: IPagebuilderOutput) {
    if (val && val.data) {
      val.data = val.data.map((m) => Page.fromJSON(m));
    }
    this._data = val;
  }
  get data(): IPagebuilderOutput | undefined {
    return this._data;
  }
  private previewWindow?: Window | null;
  private renderer!: Renderer2;
  constructor(
    private dynamicElementService: DynamicElementService,
    private dynamicDataService: DynamicDataService,

    rendererFactory: RendererFactory2,
    @Inject(DOCUMENT) private doc: Document,
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  /**
   * open preview window from page builder
   */
  async openPreview(
    data: IPagebuilderOutput,
    type: 'Print' | 'Preview' | 'ExportHml' = 'Preview',
  ): Promise<string> {
    return new Promise<string>(async (resolve, reject) => {
      this.data = data;
      this.cleanCanvas();
      this.pageContainer = this.doc.createElement('div');
      this.pageContainer.id = 'prvMRS';
      this.pageContainer.classList.add('ngx-page-builder');
      // مخفی کردن کانتینر موقت تا کاربر متوجه نشود
      this.pageContainer.style.left = '-9999px';
      this.pageContainer.style.position = 'absolute';
      this.pageContainer.style.top = '-9999px';
      this.doc.body.appendChild(this.pageContainer);

      await this.loadPageData();

      // باز کردن window جدید
      this.previewWindow = window.open(
        '', // URL را خالی می‌گذاریم چون خودمان محتوا را جابجا می‌کنیم
        '_blank',
        type == 'Print' ? '' : 'width=900,height=700,resizable=yes,scrollbars=yes',
      );

      if (!this.previewWindow) {
        Notify.error('Popup blocked! Please allow popups for this site.');
        this.cleanCanvas(); // تمیز کردن در صورت بروز خطا
        reject('Popup blocked');
        return;
      }

      // انتقال استایل‌ها و المنت‌ها به پنجره جدید
      this.transferContentToNewWindow(this.previewWindow);

      // حذف کانتینر خالی از پنجره اصلی (چون المنت‌ها به پنجره جدید منتقل شدند)
      // if (this.pageContainer && this.pageContainer.parentNode) {
      //   this.pageContainer.parentNode.removeChild(this.pageContainer);
      // }

      setTimeout(() => {
        let html = '';
        // صبر کوتاه برای لود شدن فونت‌ها و رندر شدن در پنجره جدید
        if (type == 'Print') {
          this.previewWindow?.print();
          this.previewWindow?.close();
          this.previewWindow = null;
        } else if (type == 'ExportHml') {
          this.previewWindow?.close();
          html = this.previewWindow?.document.firstElementChild?.outerHTML ?? '';
        }
        resolve(html);
      }, 1000);
    });
  }

  private async transferContentToNewWindow(targetWindow: Window) {
    if (!this.data || !this.pageContainer) return;

    const targetDoc = targetWindow.document;
    // import compiled paper.scss in assets/style.css
    const style = targetDoc.createElement('style');
    style.innerHTML = `
      body { margin: 0; padding: 0; overflow: auto; }
      @page {
        margin: 0px 0px 20px 0px;
        size: ${this.data.config.size} ${this.data.config.orientation.toLowerCase()};
        orientation: ${this.data.config.orientation}; 
      }
       
      /**************************************************/
      
.web-page-view {
  min-height: 100%;
  display: contents;
}
.web-page-view .page-body {
  min-height: 95%;
}

.paper {
  display: flex;
  flex-direction: column;
  background: #fff;
}
.paper.A4.Portrait {
  width: var(--a4-width);
  min-height: var(--a4-height);
}
.paper.A4.Landscape {
  width: var(--a4-height);
  min-height: var(--a4-width);
}
.paper.A5.Portrait {
  width: var(--a5-width);
  min-height: var(--a5-height);
}
.paper.A5.Landscape {
  width: var(--a5-height);
  min-height: var(--a5-width);
}
.paper.Letter.Portrait {
  width: var(--letter-width);
  min-height: var(--letter-height);
}
.paper.Letter.Landscape {
  width: var(--letter-height);
  min-height: var(--letter-width);
}
.paper .page-body {
  min-height: calc(var(--a5-height) / 2);
  flex: auto;
}
.paper img,
.paper svg,
.paper video {
  max-width: 100%;
  max-height: 100%;
}
.paper * {
  box-sizing: border-box;
}

.paper-inner {
  min-height: inherit;
}

.ngx-page-builder table.ngx-page-table {
  width: 100%;
  border-spacing: 0;
  border: 0;
  margin: 0;
  padding: 0;
  height: 100%;
}
.ngx-page-builder .page-break {
  page-break-after: always !important;
}
.ngx-page-builder img,
.ngx-page-builder svg {
  max-width: 100%;
  max-height: 100%;
}
.ngx-page-builder table.ngx-page-table th.repeatable-header {
  text-align: start;
  max-height: 270px; /* maximum browser page header */
  overflow: hidden;
  display: block;
}
@media print {
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  ::ng-deep.paper,
  .paper {
    display: block !important;
    width: 100% !important;
    padding: 0 !important;
    border: none !important;
    box-shadow: none !important;
  }
  html,
  body {
    min-height: 100%;
    min-width: 100%;
    margin: 0;
    padding: 0;
  }
}
    `;

    targetDoc.head.appendChild(style);
    for (let s of this.data.styles) {
      const style = targetDoc.createElement('style');
      style.innerHTML = `${s.data}`;
      style.id = s.name;
      targetDoc.head.appendChild(style);
    }

    // ۲. انتقال فیزیکی DOM Node به پنجره جدید
    // این کار باعث می‌شود Event Listenerهای Angular همچنان کار کنند
    // چون المنت‌ها از بین نمی‌روند، فقط والدشان عوض می‌شود.
    targetDoc.body.appendChild(this.pageContainer);

    // حذف استایل مخفی‌سازی که برای ساخت المنت گذاشته بودیم
    this.pageContainer.style.position = '';
    this.pageContainer.style.top = '';
    this.pageContainer.style.left = '';

    // اعمال کلاس‌های مربوط به کاغذ و جهت‌گیری
    if (LibConsts.viewMode == 'PrintPage') {
      this.pageContainer.classList.add('paper');
      this.pageContainer.classList.add(this.data.config.size);
      this.pageContainer.classList.add(this.data.config.orientation);
    } else {
      this.pageContainer.classList.add('web-page-view');
    }
  }

  /**
   * initialize preview in preview component
   */
  async initializePreview(pageContainer: HTMLElement, data: IPagebuilderOutput) {
    this.pageContainer = pageContainer;
    this.cleanCanvas();
    this.data = data;
    await this.loadPageData();
    this.setStyle();
    if (LibConsts.viewMode == 'PrintPage') {
      this.containerClassName = `paper ${this.data.config.size} ${this.data.config.orientation}`;
    } else {
      this.containerClassName = `web-page-view`;
    }

    await waitForFontsToLoad();
    await waitForRenderComplete();
  }

  //--------------------------------------------------------------------------

  private async cleanCanvas() {
    if (!this.data || !this.pageContainer) return;
    const pages = this.data.data;
    for (let page of pages) {
      if (!page) continue;
      for (let item of page.bodyItems) {
        if (item.el) {
          await this.dynamicElementService.destroy(item);
          this.renderer.removeChild(this.renderer.parentNode(item.el), item.el);
        }
      }
      for (let item of page.headerItems) {
        if (item.el) {
          await this.dynamicElementService.destroy(item);
          this.renderer.removeChild(this.renderer.parentNode(item.el), item.el);
        }
      }
      for (let item of page.footerItems) {
        if (item.el) {
          await this.dynamicElementService.destroy(item);
          this.renderer.removeChild(this.renderer.parentNode(item.el), item.el);
        }
      }
    }
    this.pageContainer.innerHTML = '';
  }
  private async loadPageData() {
    try {
      if (!this.data) return;
      const pages = this.data.data;
      for (let page of pages) {
        const isLastPage = page === pages[pages.length - 1];
        const { header, body, footer } = this.createPageHtml(isLastPage);
        // setTimeout(() => {
        const { headerItems, bodyItems, footerItems } = page;
        this.genElms(headerItems, header);
        this.genElms(bodyItems, body);
        this.genElms(footerItems, footer);
        // }, 100);
      }
      this.dynamicDataService.replaceValues(pages);
    } catch (error) {
      console.error('Error loading page data:', error);
      Notify.error('Error loading page data: ' + error);
    }
  }

  createPageHtml(isLastPage: boolean): {
    header: HTMLElement | null;
    body: HTMLElement | null;
    footer: HTMLElement | null;
  } {
    if (!this.pageContainer) {
      throw new Error('Paper element not found');
    }
    let header: HTMLElement | null = null;
    let footer: HTMLElement | null = null;
    let body: HTMLElement | null = null;
    const inner = this.doc.createElement('div');
    if (LibConsts.viewMode == 'PrintPage') {
      inner.classList.add('paper-inner');
      const mainTable = this.doc.createElement('table');
      mainTable.classList.add('ngx-page-table');
      mainTable.setAttribute('cellspacing', '0');
      mainTable.setAttribute('cellpadding', '0');
      const thead = this.doc.createElement('thead');
      const tr = this.doc.createElement('tr');
      thead.appendChild(tr);
      const Hth = this.doc.createElement('th');
      Hth.className = 'repeatable-header';
      tr.appendChild(Hth);
      const tbody = this.doc.createElement('tbody');
      const Ctr = this.doc.createElement('tr');
      tbody.appendChild(Ctr);
      const Ctd = this.doc.createElement('td');
      Ctr.appendChild(Ctd);
      const tfoot = this.doc.createElement('tfoot');
      const Ftr = this.doc.createElement('tr');
      tfoot.appendChild(Ftr);
      const Ftd = this.doc.createElement('td');
      Ftr.appendChild(Ftd);
      mainTable.appendChild(thead);
      mainTable.appendChild(tbody);
      mainTable.appendChild(tfoot);
      inner.appendChild(mainTable);

      if (!isLastPage) {
        const pageBreak = this.doc.createElement('div');
        pageBreak.classList.add('page-break');
        this.pageContainer.appendChild(pageBreak);
      }

      header = Hth;
      footer = Ftd;
      body = Ctd;
    } else {
      body = inner;
    }
    this.pageContainer.appendChild(inner);
    return { header, body, footer };
  }

  private async genElms(list: IPageItem[], container: HTMLElement | null, index = -1) {
    if (!container) return;
    for (let i = 0; i < list.length; i++) {
      list[i].el = await this.createBlockElement(list[i], container, index);
    }
  }

  private async createBlockElement(item: IPageItem, container: HTMLElement, index = -1) {
    let el = await this.dynamicElementService.createBlock(
      false,
      container,
      index,
      item as PageItem,
    );
    if (item.children && item.children.length > 0 && el) {
      for (const child of item.children) {
        await this.createBlockElement(child, el);
      }
    }
    return el;
  }

  private setStyle() {
    if (!this.data) return;
    const { size, orientation } = this.data.config;
    let finded = this.doc.querySelector('style#NgxPageBuilderPrint');
    if (finded) {
      finded.remove();
    }

    const style = this.doc.createElement('style');
    style.id = 'NgxPageBuilderPrint';
    style.innerHTML = `
       @page {
        margin: 0px 0px 20px 0px;
        size: ${size}  ${orientation.toLowerCase()};
        orientation: ${orientation}; 
      }
    `;
    this.doc.head.appendChild(style);
    for (let s of this.data.styles) {
      const style = this.doc.createElement('style');
      style.innerHTML = `${this.data.styles}`;
      style.id = s.name;
      this.doc.head.appendChild(style);
    }
  }
}
