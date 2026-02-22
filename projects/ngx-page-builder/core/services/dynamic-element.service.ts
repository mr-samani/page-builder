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

@Injectable({ providedIn: 'root' })
export class DynamicElementService {
  public dynamicData?: DynamicDataStructure;
  private renderer!: Renderer2;

  private readonly doc = inject(DOCUMENT);
  constructor(
    rendererFactory: RendererFactory2,
    private appRef: ApplicationRef,
    private envInjector: EnvironmentInjector,
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
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

    const p = item.customComponent?.providers ?? [];
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

    // ✅ ساخت Injector اختصاصی با DestroyRef
    const componentInjector = Injector.create({
      providers: p,
      parent: this.envInjector,
    });

    item.customComponent!.compInjector = componentInjector;

    // ساخت component
    const compRef: ComponentRef<any> = runInInjectionContext(componentInjector, () =>
      createComponent(component, {
        elementInjector: componentInjector,
        environmentInjector: this.envInjector,
      }),
    );
    this.appRef.attachView(compRef.hostView);

    let element = compRef.location.nativeElement as HTMLElement;

    const parentEl = container instanceof ViewContainerRef ? container.element.nativeElement : container;

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
      if (!item.el) return;

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
        if (item.options && item.options.directives && item.options.directives.length > 0) {
          item.options.directives = [];
        }
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
}
