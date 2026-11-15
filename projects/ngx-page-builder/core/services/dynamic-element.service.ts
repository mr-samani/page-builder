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
  Type,
  inputBinding,
  outputBinding,
  inject,
  isSignal,
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

interface MemberInfo {
  /** نام عمومی (alias) که Angular در template / binding استفاده می‌کند */
  publicName: string;
  /** نام property در کلاس */
  privateName: string;
}

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
   * پس بلاکی که داخل iframe نمایش داده می‌شود باید RendererFactory2 (و DOCUMENT) همان iframe را بگیرد.
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
    const parentEl = this.getParentElement(container);

    if (item.customComponent) {
      element = await this.createComponentElement(sourceItemList, editMode, container, item, index);
    } else {
      if (!item.tag) {
        item.tag = 'div';
      }
      element = this.createElementIn(parentEl.ownerDocument ?? this.doc, item.tag);
      this.insertAt(parentEl, element, index);
    }

    // Bind options و directives (باید بعد از قرار گرفتن در DOM صدا زده شود)
    element = this.bindOptions(element, item);

    // innerHTML روی host یک کامپوننت، view رندر شده‌ی خود کامپوننت را پاک می‌کند
    if (item.content && !item.customComponent) {
      this.renderer.setProperty(element, 'innerHTML', item.content);
    }

    item.el = element;
    return element;
  }

  updateElementContent(data: PageItem) {
    if (!data.el) return data.el;
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

    const customComponent = item.customComponent!;
    const parentEl = this.getParentElement(container);

    // document ی که بلاک قرار است در آن نمایش داده شود (در ادیتور: iframe بوم)
    const targetDoc: Document = parentEl.ownerDocument ?? this.doc;
    const targetEnv = targetDoc !== this.doc ? this.documentInjectors.get(targetDoc) : undefined;
    const targetAppRef = this.getAppRef(targetEnv);

    // دریافت تغییرات تنظیمات داده‌های کامپوننت سفارشی
    const onChangeCustomData = new Subject<any>();
    onChangeCustomData.subscribe((value) => {
      customComponent.componentData = value;
    });

    const context: ComponentDataContext = {
      data: customComponent.componentData,
      onChange: onChangeCustomData,
    };

    const providers: Provider[] = [
      ...(customComponent.providers ?? []),
      { provide: COMPONENT_DATA, useValue: context },
    ];

    // Injector اختصاصی کامپوننت (برای پنل تنظیمات در app اصلی هم استفاده می‌شود → بدون override)
    const componentInjector = Injector.create({ providers, parent: this.envInjector });
    customComponent.compInjector = componentInjector;

    // injector ی خودِ بلاک: DOCUMENT / RendererFactory2 ی iframe (در صورت لزوم)
    const blockInjector = this.createDocumentInjector(componentInjector, targetDoc, targetEnv) ?? componentInjector;

    let disposed = false;
    const disposeResources = () => {
      if (disposed) return;
      disposed = true;
      onChangeCustomData.complete();
      if (blockInjector !== componentInjector) this.destroyInjector(blockInjector);
      this.destroyInjector(componentInjector);
      if (customComponent.compInjector === componentInjector) {
        customComponent.compInjector = undefined as any;
      }
    };

    let compRef: ComponentRef<any> | undefined;
    let element: HTMLElement | undefined;
    try {
      // ⚠️ Angular اجازه نمی‌دهد در یک ComponentRef که inputBinding دارد (مثلاً به‌خاطر directive های دارای binding)
      // از setInput استفاده شود (NG0317). پس ورودی‌های خودِ کامپوننت را هم با inputBinding می‌دهیم
      // تا همه‌ی حالت‌ها (با/بدون directive) یکسان کار کنند.
      const componentInputs: Array<[string, any]> = [
        ['pageItem', item],
        ['editMode', editMode],
        ...Object.entries(item.options?.inputs ?? {}),
      ];
      const componentBindings: any[] = [];
      const legacyValues: Array<[string, any, boolean]> = [];
      for (const [name, value] of componentInputs) {
        const info = this.getInputInfo(component, name);
        if (info) {
          componentBindings.push(inputBinding(info.publicName, () => value));
        } else {
          // pageItem / editMode ممکن است ورودی تعریف‌شده نباشند؛ فقط برای ورودی‌های کاربر warn می‌دهیم
          legacyValues.push([name, value, name !== 'pageItem' && name !== 'editMode']);
        }
      }

      compRef = runInInjectionContext(blockInjector, () =>
        createComponent(component, {
          elementInjector: blockInjector,
          environmentInjector: targetEnv ?? this.envInjector,
          bindings: componentBindings,
          directives: this.buildDirectiveBindings(item.options?.directives),
        }),
      );
      targetAppRef.attachView(compRef.hostView);
      compRef.onDestroy(disposeResources);
      element = compRef.location.nativeElement as HTMLElement;
      (element as any).__componentRef__ = compRef;
      (element as any).__viewApplicationRef__ = targetAppRef;
      this.insertAt(parentEl, element, index);

      // ورودی‌های تعریف‌شده با inputBinding داده شدند؛ فقط property های قدیمی (غیر input) اینجا ست می‌شوند
      for (const [name, value, warn] of legacyValues) {
        this.assignLegacyProperty(compRef, name, value, warn);
      }

      // Outputs: EventEmitter / output() / model() همگی subscribe دارند
      if (item.options?.outputs) {
        const instance = compRef.instance;
        for (const [key, handler] of Object.entries(item.options.outputs)) {
          const info = this.getOutputInfo(component, key);
          const emitter = instance[info?.privateName ?? key];
          if (emitter && typeof emitter.subscribe === 'function') {
            const subscription = emitter.subscribe((value: any) => (handler as any)(value));
            compRef.onDestroy(() => {
              try {
                subscription?.unsubscribe?.();
              } catch {
                /* output may already be destroyed */
              }
            });
          } else {
            console.warn(`'${key}' is not an Angular output on ${component.name}`);
          }
        }
      }

      // اولین چرخه‌ی change detection: ngOnChanges / ngOnInit / ngAfterViewInit
      // (هم برای کامپوننت و هم برای directive های متصل به آن)
      compRef.changeDetectorRef.detectChanges();

      return element;
    } catch (error) {
      if (compRef) {
        try {
          targetAppRef.detachView(compRef.hostView);
        } catch {
          /* ignore */
        }
        try {
          compRef.destroy();
        } catch {
          /* ignore */
        }
      }
      element?.parentNode?.removeChild(element);
      disposeResources();
      throw error;
    }
  }

  //--------------------------------------------------------------------------------------------------------------
  /**
   * ## Must be call after insert to dom
   */
  private bindOptions(element: HTMLElement, item: PageItem): HTMLElement {
    if (item.options?.attributes) {
      for (const [k, v] of Object.entries(item.options.attributes)) {
        this.applyAttribute(element, k, v);
      }
    }

    // For plain HTML elements, create an Angular host view for dynamic directives.
    // Custom component directives were attached during createComponent.
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
      this.applyLinkQueryString(element, item.options.customData.queryString as CMSPageQueryString[]);
    }

    element.dataset['id'] = item.id;

    if (item.classList?.length) {
      element.classList.add(...item.classList);
    }

    return element;
  }

  /** set / remove one HTML attribute */
  private applyAttribute(element: HTMLElement, name: string, value: unknown): void {
    // HTML boolean attributes are enabled by presence; data/custom attributes keep literal values.
    if (value === null || value === undefined || (BOOLEAN_HTML_ATTRIBUTES.has(name.toLowerCase()) && value === false)) {
      this.renderer.removeAttribute(element, name);
    } else if (BOOLEAN_HTML_ATTRIBUTES.has(name.toLowerCase()) && value === true) {
      this.renderer.setAttribute(element, name, '');
    } else {
      this.renderer.setAttribute(element, name, String(value));
    }
  }

  /** appends the query string parameters to the current href of a link */
  private applyLinkQueryString(element: HTMLElement, queryString: CMSPageQueryString[]): void {
    let link = element.getAttribute('href')?.trim() || '';
    if (!link.includes('?')) {
      link += '?';
    }
    for (const q of queryString) {
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

  /**
   * Updates an already rendered block IN PLACE from a new definition of the same block
   * (attributes, text content, css classes, link query string, data source, style reference).
   * No element / component / directive is created or destroyed, so it is cheap and keeps the selection, focus and
   * drag state of the block.
   *
   * @returns false (and changes NOTHING) when the difference can not be applied in place: the caller must destroy
   * the block and create it again (text content of a block that has children).
   */
  public patchBlock(item: PageItem, next: IPageItem): boolean {
    const el = item.el;
    if (!el) return false;

    const isComponent = !!item.customComponent;
    const nextContent = next.content ?? '';
    const contentChanged = !isComponent && (item.content ?? '') !== nextContent;
    if (contentChanged && ((item.children?.length ?? 0) > 0 || (next.children?.length ?? 0) > 0)) {
      // innerHTML would remove the child elements
      return false;
    }

    // attributes
    const prevAttrs = item.options?.attributes ?? {};
    const nextAttrs = next.options?.attributes ?? {};
    let attrsChanged = false;
    for (const name of Object.keys(prevAttrs)) {
      if (!(name in nextAttrs)) {
        this.renderer.removeAttribute(el, name);
        attrsChanged = true;
      }
    }
    for (const [name, value] of Object.entries(nextAttrs)) {
      if (!Object.is(prevAttrs[name], value)) {
        this.applyAttribute(el, name, value);
        attrsChanged = true;
      }
    }
    if (el.tagName == 'IMG' && !el.hasAttribute('src')) {
      el.setAttribute('src', DEFAULT_IMAGE_URL);
    }

    // link: href + query string
    const prevQuery = item.options?.customData?.queryString;
    const nextQuery = next.options?.customData?.queryString;
    if (el.tagName == 'A' && (attrsChanged || !this.sameJson(prevQuery, nextQuery))) {
      const base = nextAttrs['href'];
      if (base === null || base === undefined) el.removeAttribute('href');
      else el.setAttribute('href', String(base).trim());
      if (Array.isArray(nextQuery)) this.applyLinkQueryString(el, nextQuery as CMSPageQueryString[]);
    }

    // text content
    if (contentChanged) {
      this.renderer.setProperty(el, 'innerHTML', nextContent);
    }

    // css classes (only the difference: classes added by other code, e.g. drag & drop, stay untouched)
    const prevClasses = item.classList ?? [];
    const nextClasses = next.classList ?? [];
    const removed = prevClasses.filter((c) => !nextClasses.includes(c));
    const added = nextClasses.filter((c) => !prevClasses.includes(c));
    if (removed.length) el.classList.remove(...removed);
    if (added.length) el.classList.add(...added);

    // model
    if (!isComponent) item.content = next.content;
    item.classList = [...nextClasses];
    item.options ??= {};
    item.options.attributes = next.options?.attributes ? { ...next.options.attributes } : undefined;
    item.options.customData = next.options?.customData;
    if (next.dataSource) item.dataSource = next.dataSource;
    item.css = next.css;
    return true;
  }

  private sameJson(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }

  /**
   * Build Angular bindings for directives. Angular applies Signal Inputs, model(),
   * decorator @Input (+ ngOnChanges), input transforms, lifecycle hooks and outputs itself.
   * ورودی‌ها/خروجی‌ها هم با نام property و هم با نام alias قابل تعریف هستند.
   */
  private buildDirectiveBindings(directives?: Directive[]): any[] {
    if (!directives?.length) return [];

    return directives
      .filter((directive) => !!directive?.directive)
      .map((directive) => {
        const DirType = directive.directive;
        const bindings: any[] = [];

        for (const [name, value] of Object.entries(directive.inputs ?? {})) {
          const info = this.getInputInfo(DirType, name);
          if (info) {
            bindings.push(inputBinding(info.publicName, () => value));
          } else {
            console.warn(`'${name}' is not an input of directive ${DirType?.name}`);
          }
        }

        for (const [name, handler] of Object.entries(directive.outputs ?? {})) {
          const info = this.getOutputInfo(DirType, name);
          if (info) {
            bindings.push(outputBinding(info.publicName, (value: any) => (handler as any)(value)));
          } else {
            console.warn(`'${name}' is not an output of directive ${DirType?.name}`);
          }
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
    const targetAppRef = this.getAppRef(targetEnv);
    const parentInjector: Injector = targetEnv ?? this.envInjector;
    const elementInjector = this.createDocumentInjector(parentInjector, targetDoc, targetEnv);

    // createComponent({hostElement}) محتوای المنت را پاک می‌کند؛ پس فرزندان را نگه می‌داریم و برمی‌گردانیم.
    const preservedNodes = Array.from(element.childNodes);

    const directiveHostRef = createComponent(DynamicDirectiveHostComponent, {
      hostElement: element,
      environmentInjector: targetEnv ?? this.envInjector,
      ...(elementInjector ? { elementInjector } : {}),
      directives: this.buildDirectiveBindings(directives),
    });

    for (const node of preservedNodes) {
      element.appendChild(node);
    }

    (element as any).__directiveHostRef__ = directiveHostRef;
    (element as any).__viewApplicationRef__ = targetAppRef;
    directiveHostRef.onDestroy(() => elementInjector && this.destroyInjector(elementInjector));

    targetAppRef.attachView(directiveHostRef.hostView);

    try {
      // Run the initial CD pass explicitly so directive lifecycle hooks (ngOnChanges, ngOnInit, ...) are not deferred.
      directiveHostRef.changeDetectorRef.detectChanges();
    } catch (error) {
      this.releaseElement(element);
      throw error;
    }
  }

  /**
   * Set a non-input property on a component instance (declared inputs are handled by inputBinding):
   *  - writable signal property → .set()
   *  - plain property → assignment
   */
  private assignLegacyProperty(
    componentRef: ComponentRef<any>,
    propertyOrPublicName: string,
    value: any,
    warnIfMissing: boolean,
  ): void {
    const instance = componentRef.instance;
    if (instance && propertyOrPublicName in instance) {
      const current = instance[propertyOrPublicName];
      if (isSignal(current) && typeof (current as any).set === 'function') {
        (current as any).set(value);
      } else if (!isSignal(current)) {
        instance[propertyOrPublicName] = value;
      }
      return;
    }

    if (warnIfMissing) {
      console.warn(`'${propertyOrPublicName}' is not an input of ${componentRef.componentType?.name}`);
    }
  }

  /**
   * Angular def format (ɵcmp / ɵdir):  inputs = { [publicName]: privateName | [privateName, flags, ...] }
   * (کلید = نام عمومی، مقدار = نام property در کلاس). این API داخلی Angular است و در یک نقطه جمع شده.
   */
  private getInputInfo(type: any, name: string): MemberInfo | null {
    return this.lookupMember((type?.ɵcmp ?? type?.ɵdir)?.inputs, name);
  }

  /** outputs = { [publicName]: privateName } */
  private getOutputInfo(type: any, name: string): MemberInfo | null {
    return this.lookupMember((type?.ɵcmp ?? type?.ɵdir)?.outputs, name);
  }

  private lookupMember(map: Record<string, any> | undefined, name: string): MemberInfo | null {
    if (!map) return null;
    const toPrivate = (meta: any): string => (Array.isArray(meta) ? meta[0] : meta);

    if (Object.prototype.hasOwnProperty.call(map, name)) {
      return { publicName: name, privateName: toPrivate(map[name]) };
    }
    for (const [publicName, meta] of Object.entries(map)) {
      if (toPrivate(meta) === name) {
        return { publicName, privateName: name };
      }
    }
    return null;
  }

  //--------------------------------------------------------------------------------------------------------------

  /**
   * ⚠️ Destroy element (children first, then own directives/component, then DOM)
   * ngOnDestroy و DestroyRef callback ها توسط Angular صدا زده می‌شوند.
   */
  public async destroy(item: IPageItem): Promise<boolean> {
    const el = item.el;
    if (!el) return false;

    if (item.children && item.children.length > 0) {
      for (const child of [...item.children]) {
        await this.destroy(child);
      }
    }

    this.releaseElement(el);

    if (el.parentNode) {
      this.renderer.removeChild(el.parentNode, el);
    }
    return true;
  }

  /**
   * Destroy component / directive host / event listeners attached to one element (not its children, not the DOM node).
   */
  private releaseElement(el: HTMLElement): void {
    const refs: ComponentRef<any>[] = [];
    const componentRef = (el as any).__componentRef__ as ComponentRef<any> | undefined;
    const directiveHostRef = (el as any).__directiveHostRef__ as ComponentRef<any> | undefined;
    if (componentRef) refs.push(componentRef);
    if (directiveHostRef) refs.push(directiveHostRef);

    const appRef = ((el as any).__viewApplicationRef__ as ApplicationRef | undefined) ?? this.appRef;

    // قبل از destroy، property ها را پاک می‌کنیم تا destroy مجدد باعث دوبار صدا خوردن hook ها نشود
    delete (el as any).__componentRef__;
    delete (el as any).__directiveHostRef__;
    delete (el as any).__viewApplicationRef__;

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

    const eventCleanups = (el as any).__eventCleanups__ as Array<() => void> | undefined;
    if (eventCleanups) {
      for (const cleanup of eventCleanups) {
        try {
          cleanup();
        } catch (error) {
          console.warn('Event listener cleanup failed:', error);
        }
      }
      delete (el as any).__eventCleanups__;
    }
  }

  async destroyBatch(items: PageItem[]) {
    for (const item of items) {
      await this.destroy(item);
    }
  }

  isContentEditable(tag: string): boolean {
    const editableTags = ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    return editableTags.indexOf(tag.toLowerCase()) >= 0;
  }

  /**
   * تغییر تگ المنت. فرزندان (DOM nodeها) منتقل می‌شوند و destroy نمی‌شوند؛
   * directive ها / event ها‌ی المنت قدیمی destroy و روی المنت جدید دوباره ساخته می‌شوند.
   */
  public async changeElementTagName(item: PageItem, newTagName: string): Promise<HTMLElement | null> {
    if (!item.el || !newTagName) {
      console.warn('Element or new tag name is missing');
      return null;
    }
    if (item.customComponent) {
      console.warn('Cannot change tag name of a custom component');
      return null;
    }

    const oldElement = item.el;
    const parent = oldElement.parentNode;

    if (!parent) {
      console.warn('Parent node not found');
      return null;
    }

    const newElement = this.createElementIn(oldElement.ownerDocument ?? this.doc, newTagName);
    this.renderer.insertBefore(parent, newElement, oldElement);

    // destroy فقط خودِ المنت (ngOnDestroy ی directive ها)، نه فرزندان
    this.releaseElement(oldElement);

    while (oldElement.firstChild) {
      this.renderer.appendChild(newElement, oldElement.firstChild);
    }
    this.renderer.removeChild(parent, oldElement);

    item.el = newElement;
    item.tag = newTagName;

    return this.bindOptions(newElement, item);
  }

  //--------------------------------------------------------------------------------------------------------------

  private getParentElement(container: HTMLElement | ViewContainerRef): HTMLElement {
    return container instanceof ViewContainerRef ? container.element.nativeElement : container;
  }

  private getAppRef(targetEnv?: EnvironmentInjector): ApplicationRef {
    return targetEnv?.get(ApplicationRef, this.appRef) ?? this.appRef;
  }

  private createElementIn(doc: Document, tag: string): HTMLElement {
    // داخل iframe، المنت را مستقیم در همان document (و realm) می‌سازیم
    return doc === this.doc ? this.renderer.createElement(tag) : doc.createElement(tag);
  }

  private insertAt(parentEl: HTMLElement, element: HTMLElement, index: number | null | undefined): void {
    if (index != null && index >= 0) {
      const refNode = parentEl.children[index] || null;
      this.renderer.insertBefore(parentEl, element, refNode);
    } else {
      this.renderer.appendChild(parentEl, element);
    }
  }

  /**
   * برای document های خارجی (iframe) injector ای می‌سازد که DOCUMENT و RendererFactory2 همان document را برمی‌گرداند.
   * Angular ریندرر را از elementInjector می‌گیرد (قبل از environmentInjector)، پس باید اینجا override شود.
   */
  private createDocumentInjector(
    parent: Injector,
    targetDoc: Document,
    targetEnv: EnvironmentInjector | undefined,
  ): Injector | undefined {
    if (targetDoc === this.doc) return undefined;
    const providers: Provider[] = [{ provide: DOCUMENT, useValue: targetDoc }];
    if (targetEnv) {
      providers.push({ provide: RendererFactory2, useValue: targetEnv.get(RendererFactory2) });
    }
    return Injector.create({ providers, parent });
  }

  private destroyInjector(injector: Injector): void {
    try {
      (injector as Injector & { destroy?: () => void }).destroy?.();
    } catch {
      /* already destroyed */
    }
  }
}
