import {
  ApplicationRef,
  EnvironmentInjector,
  Injectable,
  Injector,
  Renderer2,
  RendererFactory2,
  ViewContainerRef,
  runInInjectionContext,
  createComponent,
  DOCUMENT,
  ComponentRef,
  Provider,
  Component,
  inputBinding,
  outputBinding,
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

// prettier-ignore
const BOOLEAN_HTML_ATTRIBUTES = new Set([
  'allowfullscreen', 'async', 'autofocus', 'autoplay', 'checked', 'controls', 'default', 'defer',
  'disabled', 'formnovalidate', 'hidden', 'inert', 'ismap', 'itemscope', 'loop', 'multiple',
  'muted', 'nomodule', 'novalidate', 'open', 'playsinline', 'readonly', 'required', 'reversed',
  'selected',
]);

/**
 * Host component used to let Angular instantiate dynamic directives on an existing element.
 */
@Component({ standalone: true, template: '' })
class DynamicDirectiveHostComponent {}

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
    const targetAppRef = targetEnv?.get(ApplicationRef, this.appRef) ?? this.appRef;

    const compRef: ComponentRef<any> = runInInjectionContext(blockInjector, () =>
      createComponent(component, {
        elementInjector: blockInjector,
        environmentInjector: targetEnv ?? this.envInjector,
        directives: this.buildDirectiveBindings(item.options?.directives),
      }),
    );
    targetAppRef.attachView(compRef.hostView);

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

    // Angular inputs must be written through ComponentRef.setInput.
    this.setComponentValue(compRef, 'pageItem', item);
    this.setComponentValue(compRef, 'editMode', editMode);

    if (item.options?.inputs) {
      for (const [key, value] of Object.entries(item.options.inputs)) {
        this.setComponentValue(compRef, key, value);
      }
    }

    // Supports both EventEmitter and output() because both expose subscribe().
    if (item.options?.outputs) {
      const cleanups: Array<() => void> = [];
      for (const [key, handler] of Object.entries(item.options.outputs)) {
        const output = (instance as any)[key];
        if (output && typeof output.subscribe === 'function') {
          const subscription = output.subscribe((value: any) => (handler as any)(value));
          cleanups.push(() => subscription?.unsubscribe?.());
        } else {
          console.warn(`'${key}' is not an Angular output on ${component.name}`);
        }
      }
      if (cleanups.length) {
        compRef.onDestroy(() => cleanups.forEach((cleanup) => cleanup()));
      }
    }

    // A manually created view does not run its first lifecycle pass merely because it
    // was attached. Run the first CD pass now, after inputs are set and the host is in DOM.
    // This guarantees ngOnChanges (when applicable), ngOnInit and ngAfterViewInit run.
    compRef.changeDetectorRef.detectChanges();

    // Destroy the manually-created injectors and custom-data stream with this component.
    compRef.onDestroy(() => {
      onChangeCustomData.complete();
      if (blockInjector !== componentInjector) {
        (blockInjector as Injector & { destroy?: () => void }).destroy?.();
      }
      (componentInjector as Injector & { destroy?: () => void }).destroy?.();
      if (item.customComponent?.compInjector === componentInjector) {
        item.customComponent.compInjector = undefined as any;
      }
    });

    (element as any).__viewApplicationRef__ = targetAppRef;

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
        // HTML boolean attributes are enabled by presence; data/custom attributes keep literal values.
        if (v === null || v === undefined || (BOOLEAN_HTML_ATTRIBUTES.has(k.toLowerCase()) && v === false)) {
          this.renderer.removeAttribute(element, k);
        } else if (BOOLEAN_HTML_ATTRIBUTES.has(k.toLowerCase()) && v === true) {
          this.renderer.setAttribute(element, k, '');
        } else {
          this.renderer.setAttribute(element, k, String(v));
        }
      }
    }

    // For plain HTML elements, create an Angular host view for dynamic directives.
    // Custom component directives were attached during createComponent above.
    if (item.options?.directives?.length && !(element as any).__componentRef__) {
      this.attachDirectivesToElement(element, item.options.directives);
    }

    if (item.options?.events) {
      const eventCleanups: Array<() => void> = [];
      for (const [k, v] of Object.entries(item.options.events)) {
        const cleanup = this.renderer.listen(element, k, v as (event: Event) => void);
        if (typeof cleanup === 'function') eventCleanups.push(cleanup);
      }
      if (eventCleanups.length) {
        (element as any).__eventCleanups__ = eventCleanups;
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

  /**
   * Build Angular bindings for directives. Angular applies Signal Inputs,
   * Input transforms, lifecycle hooks and output subscriptions itself.
   */
  private buildDirectiveBindings(directives?: Directive[]): any[] {
    if (!directives?.length) return [];

    return directives
      .filter((directive) => !!directive?.directive)
      .map((directive) => {
        const DirType = directive.directive;
        const bindings: any[] = [];
        for (const [propertyName, value] of Object.entries(directive.inputs ?? {})) {
          const publicName = this.getInputMetadata(DirType, propertyName);
          if (publicName) {
            bindings.push(inputBinding(publicName.publicName, () => value));
          }
        }

        for (const [propertyName, handler] of Object.entries(directive.outputs ?? {})) {
          const publicName = this.getPublicOutputName(DirType, propertyName);
          bindings.push(outputBinding(publicName, (value: any) => (handler as any)(value)));
        }

        return { type: DirType, bindings };
      });
  }

  /**
   * Attach directives to a normal HTMLElement through an Angular-managed host view.
   */
  private attachDirectivesToElement(element: HTMLElement, directives: Directive[]): void {
    if (!directives?.length || (element as any).__directiveHostRef__) return;

    const targetDoc = element.ownerDocument ?? this.doc;
    const targetEnv = targetDoc !== this.doc ? this.documentInjectors.get(targetDoc) : undefined;

    const targetAppRef = targetEnv?.get(ApplicationRef, this.appRef) ?? this.appRef;
    const directiveHostRef = createComponent(DynamicDirectiveHostComponent, {
      hostElement: element,
      environmentInjector: targetEnv ?? this.envInjector,
      directives: this.buildDirectiveBindings(directives),
    });

    targetAppRef.attachView(directiveHostRef.hostView);
    (element as any).__directiveHostRef__ = directiveHostRef;
    (element as any).__viewApplicationRef__ = targetAppRef;

    // Run the initial CD pass explicitly so directive lifecycle hooks are not deferred.
    directiveHostRef.changeDetectorRef.detectChanges();
  }

  /**
   * Set Angular inputs supporting:
   * - @Input()
   * - input()
   * - input.required()
   * - model()
   * - Legacy component properties
   *
   * Works with components created using inputBinding/twoWayBinding.
   */
  private setComponentValue(componentRef: ComponentRef<any>, propertyOrPublicName: string, value: any): void {
    const input = this.getInputMetadata(componentRef.componentType, propertyOrPublicName);
    debugger;
    if (!input) {
      if (propertyOrPublicName in componentRef.instance) {
        componentRef.instance[propertyOrPublicName] = value;
      }
      return;
    }

    const currentValue = componentRef.instance[input.privateName];

    // Signal Input / Model Input
    if (typeof currentValue === 'function' && typeof currentValue.set === 'function') {
      currentValue.set(value);
      return;
    }

    // Classic @Input()
    componentRef.instance[input.privateName] = value;
  }

  /**
   * Resolve Angular input metadata.
   */
  private getInputMetadata(
    type: any,
    propertyOrPublicName: string,
  ): {
    privateName: string;
    publicName: string;
  } | null {
    const inputs = type?.ɵcmp?.inputs ?? type?.ɵdir?.inputs;

    if (!inputs) return null;

    for (const [privateName, metadata] of Object.entries(inputs) as Array<[string, any]>) {
      const publicName = Array.isArray(metadata)
        ? typeof metadata[0] === 'string'
          ? metadata[0]
          : privateName
        : typeof metadata === 'string'
          ? metadata
          : privateName;

      if (privateName === propertyOrPublicName || publicName === propertyOrPublicName) {
        return {
          privateName,
          publicName,
        };
      }
    }

    return null;
  }

  private getPublicOutputName(type: any, propertyName: string): string {
    const outputs = type?.ɵdir?.outputs ?? type?.ɵcmp?.outputs;
    if (!outputs) return propertyName;

    const metadata = outputs[propertyName];
    if (typeof metadata === 'string') return metadata;
    if (Array.isArray(metadata) && typeof metadata[0] === 'string') return metadata[0];

    for (const [privateName, value] of Object.entries(outputs) as Array<[string, any]>) {
      if (value === propertyName || (Array.isArray(value) && value[0] === propertyName)) {
        return privateName;
      }
    }

    return propertyName;
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

      // Angular invokes ngOnDestroy and DestroyRef callbacks automatically.
      const refs: ComponentRef<any>[] = [];
      const componentRef = (item.el as any).__componentRef__ as ComponentRef<any> | undefined;
      const directiveHostRef = (item.el as any).__directiveHostRef__ as ComponentRef<any> | undefined;
      if (componentRef) refs.push(componentRef);
      if (directiveHostRef) refs.push(directiveHostRef);

      const owningAppRef = (item.el as any).__viewApplicationRef__ as ApplicationRef | undefined;
      const appRef = owningAppRef ?? this.appRef;

      for (const ref of refs) {
        try {
          appRef.detachView(ref.hostView);
        } catch {
          // The view may already have been detached.
        }
        try {
          ref.destroy();
        } catch (error) {
          console.warn('Angular dynamic view destroy failed:', error);
        }
      }

      delete (item.el as any).__componentRef__;
      delete (item.el as any).__directiveHostRef__;
      delete (item.el as any).__viewApplicationRef__;

      const eventCleanups = (item.el as any).__eventCleanups__ as Array<() => void> | undefined;
      if (eventCleanups) {
        for (const cleanup of eventCleanups) {
          try {
            cleanup();
          } catch (error) {
            console.warn('Event listener cleanup failed:', error);
          }
        }
        delete (item.el as any).__eventCleanups__;
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
