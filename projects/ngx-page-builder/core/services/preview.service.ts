import { Renderer2, Inject, DOCUMENT, Injectable, RendererFactory2, inject } from '@angular/core';
import { DynamicDataService } from './dynamic-data.service';
import { DynamicElementService } from './dynamic-element.service';
import { NotifyHelper as Notify } from '../utiles/notify-helper';
import { PageItem } from '../models/PageItem';
import { Page } from '../models/Page';
import { IPagebuilderOutput } from '../contracts/IPageBuilderOutput';
import { IPageItem } from '../contracts/IPageItem';
import { LibConsts } from '../consts/defauls';
import { waitForFontsToLoad, waitForRenderComplete } from '../utiles/rendering';

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
  private doc = inject(DOCUMENT);
  constructor(
    private dynamicElementService: DynamicElementService,
    private dynamicDataService: DynamicDataService,
    rendererFactory: RendererFactory2
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  /**
   * open preview window from page builder
   */
  async openPreview(
    data: IPagebuilderOutput,
    type: 'Print' | 'Preview' | 'ExportHml' = 'Preview'
  ): Promise<string> {
    return new Promise<string>(async (resolve, reject) => {
      this.data = data;
      this.cleanCanvas();
      this.pageContainer = this.doc.createElement('div');
      this.pageContainer.id = 'prvMRS';
      this.pageContainer.classList.add('ngx-page-builder');
      this.pageContainer.style.left = '-9999px';
      this.pageContainer.style.position = 'absolute';
      this.pageContainer.style.top = '-9999px';
      this.doc.body.appendChild(this.pageContainer);

      await this.loadPageData();

      this.previewWindow = window.open(
        '',
        '_blank',
        type == 'Print' ? '' : 'width=900,height=700,resizable=yes,scrollbars=yes'
      );

      if (!this.previewWindow) {
        Notify.error('Popup blocked! Please allow popups for this site.');
        this.cleanCanvas();
        reject('Popup blocked');
        return;
      }

      // انتقال محتوا به window جدید
      await this.transferContentToNewWindow(this.previewWindow);

      setTimeout(() => {
        let html = '';
        if (type == 'Print') {
          this.previewWindow?.print();
          // this.previewWindow?.close();
          this.previewWindow = null;
        } else if (type == 'ExportHml') {
          html = this.previewWindow?.document.documentElement?.outerHTML ?? '';
          this.previewWindow?.close();
        }
        resolve(html);
      }, 1000);
    });
  }

  /**
   * پیدا کردن style elements مرتبط با Angular attributes
   */
  private findRelatedStyleElements(
    attributes: Set<string>,
    sourceDoc: Document
  ): HTMLStyleElement[] {
    const relatedStyles: HTMLStyleElement[] = [];
    const styleElements = sourceDoc.head.querySelectorAll('style');

    styleElements.forEach((styleEl) => {
      const content = styleEl.textContent || '';

      // چک کردن آیا این style شامل هر یک از attributes ماست؟
      let isRelated = false;
      attributes.forEach((attr) => {
        if (content.includes(attr)) {
          isRelated = true;
        }
      });

      if (isRelated) {
        relatedStyles.push(styleEl as HTMLStyleElement);
      }
    });

    return relatedStyles;
  }

  /**
   * کپی کردن فقط استایل‌های مرتبط با کامپوننت‌های استفاده شده
   */
  private copyRelatedStyles(targetDoc: Document): void {
    if (!this.pageContainer) return;
    // ۱. جمع‌آوری همه Angular attributes از pageContainer
    const usedAttributes = this.collectAngularAttributes(this.pageContainer);

    console.log('🔍 Found Angular attributes:', Array.from(usedAttributes));

    // ۲. پیدا کردن style elements مرتبط
    const relatedStyles = this.findRelatedStyleElements(usedAttributes, this.doc);

    console.log('📝 Found related style elements:', relatedStyles.length);

    // ۳. کپی کردن فقط style های مرتبط
    relatedStyles.forEach((styleEl) => {
      const clonedStyle = targetDoc.createElement('style');
      clonedStyle.textContent = styleEl.textContent;

      // کپی کردن attributes (id, nonce, و غیره)
      Array.from(styleEl.attributes).forEach((attr) => {
        clonedStyle.setAttribute(attr.name, attr.value);
      });

      targetDoc.head.appendChild(clonedStyle);
    });

    // ۴. کپی کردن link stylesheets که global هستند
    // (اینها معمولاً برای Bootstrap, FontAwesome و غیره هستند)
    // const linkElements = this.doc.head.querySelectorAll('link[rel="stylesheet"]');
    // linkElements.forEach((linkEl) => {
    //   const clonedLink = targetDoc.createElement('link');

    //   Array.from(linkEl.attributes).forEach((attr) => {
    //     clonedLink.setAttribute(attr.name, attr.value);
    //   });

    //   targetDoc.head.appendChild(clonedLink);
    // });
  }
  /**
   * جمع‌آوری همه Angular ViewEncapsulation attributes از یک element و children هاش
   */
  private collectAngularAttributes(element: HTMLElement): Set<string> {
    const attributes = new Set<string>();

    // Recursive function برای traverse کردن DOM tree
    const traverse = (el: Element) => {
      // بررسی همه attribute های المنت
      Array.from(el.attributes).forEach((attr) => {
        const attrName = attr.name;

        // پیدا کردن Angular ViewEncapsulation attributes
        // Pattern: _nghost-xxx-yyy یا _ngcontent-xxx-yyy
        if (attrName.startsWith('_nghost-') || attrName.startsWith('_ngcontent-')) {
          attributes.add(attrName);

          // همچنین base attribute رو هم اضافه کن
          // مثلا از _ngcontent-abc-c123 به _nghost-abc-c123
          const baseAttr = attrName.replace('_ngcontent-', '_nghost-');
          attributes.add(baseAttr);
        }
      });

      // بررسی children
      Array.from(el.children).forEach((child) => {
        traverse(child);
      });
    };

    traverse(element);
    return attributes;
  }
  private async transferContentToNewWindow(targetWindow: Window) {
    if (!this.data || !this.pageContainer) return;

    const targetDoc = targetWindow.document;

    // ۱. کپی کردن فقط استایل‌های مرتبط با کامپوننت‌های استفاده شده
    setTimeout(() => {
      this.copyRelatedStyles(targetDoc);
      // TODO: wait for load all components ended
    }, 100);

    // ۲. اضافه کردن استایل‌های سفارشی preview
    const style = targetDoc.createElement('style');
    style.innerHTML = `
      body { margin: 0; padding: 0; overflow: auto; }
      @page {
        margin: 0px 0px 20px 0px;
        size: ${this.data.config.size} ${this.data.config.orientation.toLowerCase()};
        orientation: ${this.data.config.orientation}; 
      }
        ${this.copyAllStyles()}
    `;
    targetDoc.head.appendChild(style);

    // 3. اضافه کردن CSS های عمومی (Bootstrap و غیره)
    for (let css of LibConsts.publicCss) {
      const s = targetDoc.createElement('link');
      s.href = css;
      s.rel = 'stylesheet';
      s.type = 'text/css';
      s.id =
        'S_' + (css.split('/').pop()?.split('.').at(0) ?? 'publicCss-' + Math.random() * 10000);
      targetDoc.head.appendChild(s);
    }

    // 4. اضافه کردن استایل‌های کاربر
    for (let s of this.data.styles) {
      const style = targetDoc.createElement('style');
      style.innerHTML = `${s.data}`;
      style.id = s.name;
      targetDoc.head.appendChild(style);
    }

    // ۵. اضافه کردن JavaScript های عمومی
    for (let js of LibConsts.publicJs) {
      const j = targetDoc.createElement('script');
      j.src = js;
      j.id = 'j_' + (js.split('/').pop()?.split('.').at(0) ?? 'publicJs-' + Math.random() * 10000);
      targetDoc.head.appendChild(j);
    }

    // ۶. انتقال فیزیکی DOM Node به پنجره جدید
    targetDoc.body.appendChild(this.pageContainer);

    // حذف استایل مخفی‌سازی
    this.pageContainer.style.position = '';
    this.pageContainer.style.top = '';
    this.pageContainer.style.left = '';

    this.copyDynamicStyles(targetDoc);

    // اعمال کلاس‌های مربوط به کاغذ
    if (LibConsts.viewMode == 'PrintPage') {
      this.pageContainer.classList.add('ngx-paper');
      this.pageContainer.classList.add(this.data.config.size);
      this.pageContainer.classList.add(this.data.config.orientation);
    } else {
      this.pageContainer.classList.add('web-page-view');
    }
  }
  /**
   * کپی کردن همه استایل‌ها از document اصلی
   *
   * TODO: همه استایل های پروژه نباید انتقال پیدا کند فقط استایل ها استفاده شده در صفحه ساز
   */
  private copyAllStyles(): string {
    const styles = Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((el) => el.outerHTML)
      .join('\n');

    return styles;
  }
  /**
   * کپی کردن استایل‌هایی که بعد از render اضافه شدند
   * TODO: همه استایل های پروژه نباید انتقال پیدا کند فقط استایل ها استفاده شده در صفحه ساز
   */
  private copyDynamicStyles(targetDoc: Document): void {
    const mainDocStyles = document.head.querySelectorAll('style');
    const iframeStyles = new Set(
      Array.from(targetDoc.head.querySelectorAll('style')).map((s) => s.textContent)
    );

    mainDocStyles.forEach((styleEl) => {
      // اگه این style قبلاً کپی نشده، کپی کن
      if (!iframeStyles.has(styleEl.textContent)) {
        const clonedStyle = styleEl.cloneNode(true) as HTMLStyleElement;
        targetDoc.head.appendChild(clonedStyle);
      }
    });
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
      this.containerClassName = `ngx-paper ${this.data.config.size} ${this.data.config.orientation}`;
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

        const { headerItems, bodyItems, footerItems } = page;
        await this.genElms(headerItems, header);
        await this.genElms(bodyItems, body);
        await this.genElms(footerItems, footer);
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

  async createBlockElement(item: IPageItem, container: HTMLElement, index = -1) {
    let el = await this.dynamicElementService.createBlock(
      false,
      container,
      index,
      item as PageItem
    );
    if (!(item as PageItem).customComponent && item.children && item.children.length > 0 && el) {
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

    // اضافه کردن styles به صورت تکی
    for (let s of this.data.styles) {
      let existingStyle = this.doc.querySelector(`style#${s.name}`);
      if (existingStyle) {
        existingStyle.remove();
      }

      const style = this.doc.createElement('style');
      style.innerHTML = s.data;
      style.id = s.name;
      this.doc.head.appendChild(style);
    }
  }
}
