import {
  ApplicationRef,
  ElementRef,
  EnvironmentInjector,
  Injectable,
  Injector,
  Renderer2,
  RendererFactory2,
  ViewContainerRef,
  runInInjectionContext,
  createComponent,
  EventEmitter,
  Inject,
  DOCUMENT,
  ComponentRef,
  Provider,
  inject,
} from '@angular/core';
import 'reflect-metadata';
import { Subject } from 'rxjs';
import { DynamicDataStructure } from '../models/DynamicData';
import { PageItem } from '../models/PageItem';
import { ComponentDataContext } from '../models/ComponentDataContext';
import { COMPONENT_DATA } from '../models/tokens';
import { DEFAULT_IMAGE_URL } from '../consts/defaults';
import { Directive, SourceItem } from '../models/SourceItem';
import { IPageItem } from '../contracts/IPageItem';
import { CMSPageQueryString } from '../models/CMSPage';

@Injectable({ providedIn: 'root' })
export class DynamicElementService {
  public dynamicData?: DynamicDataStructure;
  private renderer!: Renderer2;

  private readonly doc = inject(DOCUMENT);

  /**
   * هر document ی (مثلاً iframe بوم ادیتور) که یک Angular Application جداگانه دارد.
   * Angular استایل هر کامپوننت را از طریق RendererFactory2 در <head> ی همان document می‌نویسد؛
   * پس بلاکی که داخل iframe نمایش داده می‌شود باید RendererFactory2 (و DOCUMENT) همان iframe را بگیرد،
   * وگرنه استایل‌هایش در document اصلی می‌مانند و به iframe نمی‌رسند.
   */
  private readonly documentInjectors = new WeakMap<Document, EnvironmentInjector>();

  constructor(
    rendererFactory: RendererFactory2,
    private appRef: ApplicationRef,
    private envInjector: EnvironmentInjector,
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  /**
   * معرفی Angular Application ی که یک document جداگانه (iframe) را مدیریت می‌کند.
   * بلاک‌هایی که داخل این document ساخته می‌شوند، رندرر / استایل / DOCUMENT همان document را می‌گیرند.
   * باید قبل از ساخت اولین بلاک صدا زده شود.
   */
  registerDocument(doc: Document, injector: EnvironmentInjector): void {
    this.documentInjectors.set(doc, injector);
  }

  unregisterDocument(doc: Document): void {
    this.documentInjectors.delete(doc);
  }

  /**
   * create html element on droped to page
   * ایجاد المنت از روی سورس ها
   */
  async createBlock(
    sourceItemList: SourceItem[],
    editMode: boolean,
    container: HTMLElement | ViewContainerRef,
    index: number,
    item: PageItem,
  ): Promise<HTMLElement> {
    let element: HTMLElement;
    const parentEl: HTMLElement = container instanceof ViewContainerRef ? container.element.nativeElement : container;

    if (item.customComponent) {
      element = await this.createComponentElement(sourceItemList, editMode, container, item, index);
    } else {
      if (!item.tag) {
        item.tag = 'div';
      }
      element = this.renderer.createElement(item.tag);

      if (index != null && index >= 0) {
        const refNode = parentEl.children[index] || null;
        this.renderer.insertBefore(parentEl, element, refNode);
      } else {
        this.renderer.appendChild(parentEl, element);
      }
    }

    // Bind options و directives
    element = this.bindOptions(element, item);

    if (item.content) {
      this.renderer.setProperty(element, 'innerHTML', item.content);
    }

    item.el = element;
    return element;
  }

  updateElementContent(data: PageItem) {
    this.renderer.setProperty(data.el, 'innerHTML', data.content);
    return data.el;
  }

  private async createComponentElement(
    sourceItemList: SourceItem[],
    editMode: boolean,
    container: HTMLElement | ViewContainerRef,
    item: PageItem,
    index: number | null,
  ): Promise<HTMLElement> {
    const component = await item.getComponentInstance(sourceItemList);
    if (!component) {
      console.warn('Not exist custom component:', item.customComponent);
      throw new Error('Not exist custom component');
    }

    const parentEl: HTMLElement = container instanceof ViewContainerRef ? container.element.nativeElement : container;

    // document ی که بلاک قرار است در آن نمایش داده شود (در ادیتور: iframe بوم)
    const targetDoc: Document = parentEl.ownerDocument ?? this.doc;
    const isForeignDoc = targetDoc !== this.doc;
    // Application ی که آن document را مدیریت می‌کند (اگر ثبت نشده باشد، رفتار قبلی)
    const targetEnv = isForeignDoc ? this.documentInjectors.get(targetDoc) : undefined;

    const p = [...(item.customComponent?.providers ?? [])];
    // دریافت تغییرات  تنظیمات داده‌های کامپوننت سفارشی
    const onChangeCustomData = new Subject();
    onChangeCustomData.subscribe((value) => {
      item.customComponent!.componentData = value;
    });

    const context: ComponentDataContext = {
      data: item.customComponent?.componentData,
      onChange: onChangeCustomData,
    };

    p.push({ provide: COMPONENT_DATA, useValue: context });
    // داخل iframe:
    //  - inject(DOCUMENT) و @HostListener('document:...') باید به document ی iframe اشاره کنند
    //  - RendererFactory2 باید مال application ی iframe باشد تا استایل کامپوننت در <head> ی iframe نوشته شود
    //    (Angular ریندرر را از elementInjector می‌گیرد، نه از environmentInjector، پس باید اینجا override شود)
    // change detection مثل قبل با application اصلی (appRef) انجام می‌شود.
    // نکته: این override ها فقط برای خودِ بلاک (داخل iframe) هستند؛ پنل تنظیمات بلاک در app اصلی
    // رندر می‌شود و از compInjector استفاده می‌کند، پس نباید این‌ها را داخل compInjector بگذاریم.
    const renderOverrides: Provider[] = [];
    if (isForeignDoc) {
      renderOverrides.push({ provide: DOCUMENT, useValue: targetDoc });
      if (targetEnv) {
        renderOverrides.push({ provide: RendererFactory2, useValue: targetEnv.get(RendererFactory2) });
      }
    }

    // ✅ ساخت Injector اختصاصی با DestroyRef
    const componentInjector = Injector.create({
      providers: p,
      parent: this.envInjector,
    });

    // این injector برای پنل تنظیمات (app اصلی) استفاده می‌شود → بدون override
    item.customComponent!.compInjector = componentInjector;

    // injector ی خودِ بلاک: روی componentInjector، با DOCUMENT / RendererFactory2 ی iframe
    const blockInjector = renderOverrides.length
      ? Injector.create({ providers: renderOverrides, parent: componentInjector })
      : componentInjector;

    // ساخت component
    const compRef: ComponentRef<any> = runInInjectionContext(blockInjector, () =>
      createComponent(component, {
        elementInjector: blockInjector,
        environmentInjector: this.envInjector,
      }),
    );
    this.appRef.attachView(compRef.hostView);

    let element = compRef.location.nativeElement as HTMLElement;

    if (index != null && index >= 0) {
      const refNode = parentEl.children[index] || null;
      this.renderer.insertBefore(parentEl, element, refNode);
    } else {
      this.renderer.appendChild(parentEl, element);
    }
    // ذخیره برای cleanup
    (element as any).__componentRef__ = compRef;

    const instance = compRef.instance;
    // set default propery pageItem
    if ('pageItem' in instance) {
      instance['pageItem'] = item;
    }
    if ('editMode' in instance) {
      instance['editMode'] = editMode;
    }

    // ✅ Inputs
    if (item.options && item.options.inputs) {
      for (const [key, val] of Object.entries(item.options.inputs)) {
        instance[key] = val;
      }
    }

    // ✅ Outputs
    if (item.options?.outputs) {
      for (const [key, handler] of Object.entries(item.options.outputs)) {
        const emitter = (instance as any)[key];
        if (emitter instanceof EventEmitter) {
          emitter.subscribe((value: any) => handler(value));
        } else {
          console.warn(`⚠️ '${key}' is not an EventEmitter on ${component.name}`);
        }
      }
    }
    return element;
  }

  //--------------------------------------------------------------------------------------------------------------
  /**
   * ## Must be call after insert to dom
   * @param element
   * @param item
   * @returns
   */
  private bindOptions(element: HTMLElement, item: PageItem): HTMLElement {
    if (item.options?.attributes) {
      for (const [k, v] of Object.entries(item.options.attributes)) {
        this.renderer.setAttribute(element, k, v);
      }
    }

    // ✅ Attach کردن directive‌ها
    const directiveInstances: any[] = [];
    let directiveInjector: Injector | undefined;

    if (item.options && item.options.directives?.length) {
      // ساخت یه injector مشترک برای همه directive‌ها
      directiveInjector = Injector.create({
        providers: [
          { provide: ElementRef, useValue: new ElementRef(element) },
          { provide: Renderer2, useValue: this.renderer },
        ],
        parent: this.envInjector,
      });

      for (const DirType of item.options.directives) {
        const dirInstance = this.attachDirective(element, DirType, directiveInjector);

        if (dirInstance) {
          directiveInstances.push(dirInstance);
        }
      }
    }

    if (item.options?.events) {
      for (const [k, v] of Object.entries(item.options.events)) {
        this.renderer.listen(element, k, v);
      }
    }

    if (element.tagName == 'IMG' && !element.hasAttribute('src')) {
      element.setAttribute('src', DEFAULT_IMAGE_URL);
    }

    if (element.tagName == 'A' && Array.isArray(item.options?.customData?.queryString)) {
      let link = element.getAttribute('href')?.trim() || '';
      if (!link.includes('?')) {
        link += '?';
      }
      for (let q of item.options.customData.queryString as CMSPageQueryString[]) {
        if (!link.endsWith('?')) {
          link += '&';
        }
        if (q.isDynamic) {
          link += q.key + '=' + q.dynamicValue;
        } else {
          link += q.key + '=' + q.value;
        }
      }
      element.setAttribute('href', link);
    }
    // if (
    //   element.tagName == 'INPUT' ||
    //   element.tagName == 'TEXTAREA' ||
    //   element.tagName == 'SELECT'
    // ) {
    //   element.setAttribute('readonly', 'true');
    // }

    element.dataset['id'] = item.id;

    // if (item.options?.text && element.innerText !== item.options.text) {
    //   this.renderer.appendChild(element, this.renderer.createText(item.options.text));
    // }
    // if (this.isContentEditable(tag)) {
    //   element.contentEditable = 'true';
    // }
    // if (item.style) {
    //   element.style.cssText = item.style;
    // }

    if (item.classList) {
      element.classList.add(...item.classList);
    }

    return element;
  }

  private attachDirective<T>(element: HTMLElement, directive: Directive, dirInjector: Injector): any {
    const DirType = directive.directive;
    const { inputs, outputs } = directive;
    if (!DirType) return null;

    // خواندن metadata پارامترهای سازنده
    let paramTypes: any[] = [];
    try {
      paramTypes = Reflect.getMetadata('design:paramtypes', DirType) || [];
    } catch {
      paramTypes = [];
    }

    // ساخت instance
    let dirInstance: any;
    try {
      dirInstance = runInInjectionContext(dirInjector, () => {
        if (paramTypes && paramTypes.length) {
          const deps = paramTypes.map((p: any) => {
            try {
              return dirInjector.get(p);
            } catch (err) {
              console.warn('Could not resolve dependency:', p, err);
              return undefined;
            }
          });
          return new (DirType as any)(...deps);
        } else {
          return new (DirType as any)(new ElementRef(element));
        }
      });
    } catch (err) {
      console.error('Error creating directive instance:', err);
      dirInstance = new (DirType as any)(new ElementRef(element));
    }

    // ✅ Inputs
    if (inputs) {
      for (const [key, val] of Object.entries(inputs)) {
        dirInstance[key] = val;
      }
    }

    // ✅ Outputs
    if (outputs) {
      for (const [key, handler] of Object.entries(outputs)) {
        const emitter = (dirInstance as any)[key];
        if (emitter instanceof EventEmitter) {
          emitter.subscribe((value: any) => handler(value));
        } else {
          console.warn(`⚠️ '${key}' is not an EventEmitter on ${DirType.name}`);
        }
      }
    }

    const selectorName = (DirType as any).ɵdir?.selectors?.[0]?.find((x: any) => x !== '');
    if (selectorName) {
      element.setAttribute(selectorName, '');
    }
    // ✅ فراخوانی ngOnInit
    if (typeof dirInstance.ngOnInit === 'function') {
      try {
        dirInstance.ngOnInit();
      } catch (err) {
        console.error('ngOnInit error:', err);
      }
    }

    // ✅ فراخوانی ngAfterViewInit بعد از اضافه شدن به DOM
    setTimeout(() => {
      if (typeof dirInstance.ngAfterViewInit === 'function') {
        try {
          dirInstance.ngAfterViewInit();
        } catch (err) {
          console.error('ngAfterViewInit error:', err);
        }
      }
    }, 0);

    const cleanupFns: (() => void)[] = [];

    // wrap ngOnDestroy
    const originalDestroy = dirInstance.ngOnDestroy?.bind(dirInstance);
    dirInstance.ngOnDestroy = () => {
      try {
        cleanupFns.forEach((f) => f());
      } catch {}
      if (originalDestroy) {
        try {
          originalDestroy();
        } catch {}
      }
    };

    // ذخیره برای fallback
    if (!(element as any).__ngDirectives__) {
      (element as any).__ngDirectives__ = [];
    }
    (element as any).__ngDirectives__.push(dirInstance);

    return dirInstance;
  }

  /**
   * ⚠️ Destroy element
   */
  public destroy(item: IPageItem): Promise<boolean> {
    return new Promise<boolean>(async (resolve, reject) => {
      if (!item.el) {
        resolve(false);
        return;
      }

      if (item.children && item.children.length > 0) {
        for (let child of item.children) {
          await this.destroy(child);
        }
      }

      // Manual cleanup قبل از حذف
      // component
      const compRef = (item.el as any).__componentRef__;
      if (compRef) {
        this.appRef.detachView(compRef.hostView);
        compRef.destroy();
        delete (item.el as any).__componentRef__;
      }
      // directive
      const directiveInstances = (item.el as any).__ngDirectives__;
      if (Array.isArray(directiveInstances)) {
        for (const d of directiveInstances) {
          if (d && typeof d.ngOnDestroy === 'function') {
            d.ngOnDestroy?.();
          }
        }
        delete (item.el as any).__ngDirectives__;
      }

      // حذف از DOM
      if (item.el.parentNode) {
        this.renderer.removeChild(item.el.parentNode, item.el);
      }
      resolve(true);
    });
  }

  async destroyBatch(items: PageItem[]) {
    for (let item of items) {
      await this.destroy(item);
    }
  }

  isContentEditable(tag: string): boolean {
    const editableTags = ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    return editableTags.indexOf(tag.toLowerCase()) > 0;
  }

  /**
   * تغییر تگ المنت
   */
  public async changeElementTagName(item: PageItem, newTagName: string): Promise<HTMLElement | null> {
    if (!item.el || !newTagName) {
      console.warn('Element or new tag name is missing');
      return null;
    }

    const oldElement = item.el;
    const parent = oldElement.parentNode;

    if (!parent) {
      console.warn('Parent node not found');
      return null;
    }

    // ساخت المنت جدید
    let newElement = this.renderer.createElement(newTagName);

    //  کپی innerHTML
    const innerContent = oldElement.innerHTML;
    if (innerContent) {
      this.renderer.setProperty(newElement, 'innerHTML', innerContent);
    }

    //  جایگزینی در DOM
    this.renderer.insertBefore(parent, newElement, oldElement);

    await this.destroy(item);
    //  به‌روزرسانی مرجع در item
    item.el = newElement;
    item.tag = newTagName;
    // Bind options و directives
    newElement = this.bindOptions(newElement, item);

    return newElement;
  }
}
