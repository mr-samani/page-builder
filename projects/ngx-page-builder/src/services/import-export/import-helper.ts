import { PageItem } from '../../models/PageItem';
import { ISourceOptions } from '../../models/SourceItem';
import {
  CONVERT_TAGS,
  DEFAULT_ALLOWED_ATTRIBUTES,
  NOT_ALLOWED_TAGS,
  USEFUL_STYLES,
} from './allowed-consts';
import { ImportOptions } from './ImportOptions';
import { StyleHelper } from './style-helper';

export abstract class HtmlImporter {
  /**
   * دریافت و رندر کردن SPA با استفاده از iframe
   */
  static async fetchWithSpaRenderer(url: string, options?: ImportOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      // ساخت iframe مخفی
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.style.position = 'absolute';
      iframe.style.width = '1920px';
      iframe.style.height = '1080px';

      // تنظیم sandbox برای امنیت
      iframe.sandbox.add('allow-same-origin', 'allow-scripts');

      document.body.appendChild(iframe);

      let timeoutId: any;
      let resolved = false;

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (iframe && iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      };

      // Timeout برای رندر شدن
      const waitTime = options?.spaWaitTime || 10000; // پیش‌فرض 10 ثانیه

      iframe.onload = () => {
        try {
          // منتظر بمانیم تا JavaScript ها اجرا شوند
          timeoutId = setTimeout(() => {
            if (resolved) return;
            resolved = true;

            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

              if (!iframeDoc) {
                cleanup();
                reject(new Error('Unable to access iframe content (possibly due to CORS)'));
                return;
              }

              const html = iframeDoc.documentElement.outerHTML;
              cleanup();
              resolve(html);
            } catch (error: any) {
              cleanup();
              reject(new Error(`Error reading iframe content: ${error.message}`));
            }
          }, waitTime);
        } catch (error: any) {
          cleanup();
          reject(error);
        }
      };

      iframe.onerror = (error) => {
        cleanup();
        reject(new Error('Error loading iframe'));
      };

      // بارگذاری URL
      try {
        iframe.src = url;
      } catch (error) {
        cleanup();
        reject(error);
      }

      // Timeout کلی
      setTimeout(() => {
        if (!resolved) {
          cleanup();
          reject(new Error('Timeout: Timed out waiting for page to load'));
        }
      }, waitTime + 5000);
    });
  }

  /**
   * رندر کردن HTML در iframe و گرفتن Document با استایل‌های computed
   */
  static async renderHtmlInIframe(htmlString: string, options?: ImportOptions): Promise<Document> {
    return new Promise((resolve, reject) => {
      // ساخت iframe مخفی
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.style.position = 'absolute';
      iframe.style.width = '1920px';
      iframe.style.height = '1080px';

      // تنظیم sandbox برای امنیت
      iframe.sandbox.add('allow-same-origin');

      document.body.appendChild(iframe);

      let timeoutId: any;
      let resolved = false;

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        // نگه داشتن iframe تا استایل‌ها extract بشن
        // بعداً در convertElementToPageItem پاک می‌شه
      };

      // Timeout برای رندر شدن
      const waitTime = options?.spaWaitTime || 2000; // 2 ثانیه برای HTML string

      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

        if (!iframeDoc) {
          document.body.removeChild(iframe);
          reject(new Error('Cannot access iframe document'));
          return;
        }

        // نوشتن HTML در iframe
        iframeDoc.open();
        iframeDoc.write(htmlString);
        iframeDoc.close();

        // منتظر load شدن
        iframe.onload = () => {
          timeoutId = setTimeout(() => {
            if (resolved) return;
            resolved = true;

            try {
              const finalDoc = iframe.contentDocument || iframe.contentWindow?.document;

              if (!finalDoc) {
                document.body.removeChild(iframe);
                reject(new Error('Cannot access iframe document after load'));
                return;
              }

              // ذخیره reference به iframe برای cleanup بعدی
              (finalDoc as any).__iframe = iframe;

              resolve(finalDoc);
            } catch (error: any) {
              document.body.removeChild(iframe);
              reject(new Error(`Error reading iframe content: ${error.message}`));
            }
          }, waitTime);
        };

        // اگر بدون event load، با timeout resolve کن
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            const finalDoc = iframe.contentDocument || iframe.contentWindow?.document;

            if (finalDoc) {
              (finalDoc as any).__iframe = iframe;
              resolve(finalDoc);
            } else {
              document.body.removeChild(iframe);
              reject(new Error('Timeout: iframe loading failed'));
            }
          }
        }, waitTime + 1000);
      } catch (error: any) {
        document.body.removeChild(iframe);
        reject(error);
      }
    });
  }

  /**
   * تبدیل HTMLElement به PageItem
   */
  static async convertElementToPageItem(
    element: HTMLElement,
    options?: ImportOptions,
  ): Promise<PageItem | null> {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const pageItem = new PageItem();
    let tagName = element.tagName.toLowerCase();

    if (CONVERT_TAGS[tagName]) {
      tagName = CONVERT_TAGS[tagName];
    }

    // نادیده گرفتن script و style tags
    if (NOT_ALLOWED_TAGS.includes(tagName)) {
      return null;
    }

    pageItem.tag = tagName;

    // تعیین canHaveChild بر اساس تگ
    pageItem.canHaveChild = this.canHaveChildren(pageItem.tag);
    // استخراج محتوای متنی (فقط برای تگ‌های بدون فرزند)
    // if (!pageItem.canHaveChild || element.children.length === 0) {
    const textContent = this.getDirectTextContent(element);
    if (textContent) {
      pageItem.content = textContent;
    }
    //}

    // استخراج options (attributes, inputs, outputs)
    pageItem.options = this.extractOptions(element, options);

    // استخراج استایل‌ها (با پشتیبانی از computed styles در iframe)
    // TODO: Import style to class
    const css = await StyleHelper.extractStyles(element, options);
    if (css) {
      debugger;
      const className = pageItem.tag + '_' + pageItem.id;
      pageItem.classList = [className];
      pageItem.css = `.${className}{${css}}`;
    }

    // پردازش فرزندان
    if (pageItem.canHaveChild && element.children.length > 0) {
      pageItem.children = [];

      for (let i = 0; i < element.children.length; i++) {
        const child = element.children[i] as HTMLElement;
        const childPageItem = await this.convertElementToPageItem(child, options);

        if (childPageItem) {
          childPageItem.parent = pageItem;
          pageItem.children.push(childPageItem);
        }
      }
    }

    // پاک کردن iframe اگر این آخرین element root بود
    if (!element.parentElement || element.parentElement.tagName.toLowerCase() === 'body') {
      this.cleanupIframeIfExists(element.ownerDocument);
    }

    return pageItem;
  }

  /**
   * تعیین اینکه تگ می‌تواند فرزند داشته باشد
   */
  private static canHaveChildren(tag: string): boolean {
    const noChildTags = [
      'img',
      'input',
      'br',
      'hr',
      'meta',
      'link',
      'area',
      'base',
      'col',
      'embed',
      'param',
      'source',
      'track',
      'wbr',
    ];

    return !noChildTags.includes(tag.toLowerCase());
  }
  /**
   * گرفتن محتوای مستقیم متنی (بدون فرزندان)
   */
  private static getDirectTextContent(element: HTMLElement): string {
    let text = '';

    element.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || '';
      }
    });

    return text.trim();
  }

  /**
   * پاک کردن iframe اگر وجود داشته باشه
   */
  private static cleanupIframeIfExists(doc: Document): void {
    try {
      const iframe = (doc as any).__iframe;
      if (iframe && iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
        delete (doc as any).__iframe;
      }
    } catch (error) {
      console.warn('Error cleaning up iframe:', error);
    }
  }

  /**
   * بررسی اینکه آیا مقدار، مقدار پیش‌فرض است
   */
  private static isDefaultValue(propertyName: string, value: string): boolean {
    const defaults: Record<string, string[]> = {
      display: ['inline', 'block'],
      position: ['static'],
      color: ['rgb(0, 0, 0)', 'rgba(0, 0, 0, 0)'],
      'background-color': ['rgba(0, 0, 0, 0)', 'transparent'],
      'font-size': ['16px', '14px'],
      'font-weight': ['400', 'normal'],
      margin: ['0px'],
      padding: ['0px'],
      border: ['0px none rgb(0, 0, 0)'],
      'border-width': ['0px'],
      width: ['auto'],
      height: ['auto'],
    };

    const defaultValues = defaults[propertyName];
    if (defaultValues) {
      return defaultValues.some((def) => value === def);
    }

    // اگر مقدار 0px یا 0 باشه
    if (value === '0px' || value === '0') {
      return true;
    }

    return false;
  }

  /**
   * استخراج options از المنت
   */
  private static extractOptions(element: HTMLElement, options?: ImportOptions): ISourceOptions {
    const allowedAttrs = options?.allowedAttributes || DEFAULT_ALLOWED_ATTRIBUTES;
    const attributes: Record<string, any> = {};

    // استخراج attribute ها
    Array.from(element.attributes).forEach((attr) => {
      const attrName = attr.name;

      // بررسی مجاز بودن attribute
      const isAllowed = allowedAttrs.some((allowed) => {
        if (allowed.endsWith('*')) {
          // برای الگوهای wildcard مثل data-* و aria-*
          const prefix = allowed.slice(0, -1);
          return attrName.startsWith(prefix);
        }
        return attrName === allowed;
      });

      if (isAllowed) {
        attributes[attrName] = attr.value;
      }
    });

    const sourceOptions: ISourceOptions = {};

    if (Object.keys(attributes).length > 0) {
      sourceOptions.attributes = attributes;
    }

    return sourceOptions;
  }

  /**
   * بررسی اینکه آیا استایل باید شامل شود
   */
  private static shouldIncludeStyle(
    propertyName: string,
    value: string,
    options?: ImportOptions,
  ): boolean {
    // اگر فیلتر سفارشی داریم
    if (options?.styleFilter) {
      return options.styleFilter(propertyName, value);
    }

    // فیلتر پیش‌فرض: فقط استایل‌های مفید
    return USEFUL_STYLES.includes(propertyName);
  }
}
