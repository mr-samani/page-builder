import {
  ApplicationRef,
  Component,
  ComponentRef,
  DOCUMENT,
  EnvironmentInjector,
  Injectable,
  Injector,
  Provider,
  Renderer2,
  RendererFactory2,
  ViewContainerRef,
  WritableSignal,
  createComponent,
  createEnvironmentInjector,
  inject,
  inputBinding,
  isSignal,
  outputBinding,
  signal,
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

// ───────────────────────── types & helpers ─────────────────────────

interface MemberInfo {
  /** نام عمومی (alias) که Angular در template / binding استفاده می‌کند */
  publicName: string;
  /** نام property در کلاس */
  privateName: string;
}

interface MemberTable {
  inputs: Map<string, MemberInfo>;
  outputs: Map<string, MemberInfo>;
}

/** چیزهایی که روی خود المنت نگه می‌داریم (برای destroy و update درجا) */
interface BlockHostElement extends HTMLElement {
  __componentRef__?: ComponentRef<any>;
  __directiveHostRef__?: ComponentRef<any>;
  __viewApplicationRef__?: ApplicationRef;
  __eventCleanups__?: Array<() => void>;
  __inputSignals__?: Map<string, WritableSignal<unknown>>;
}

/** Document ی که بلاک در آن نمایش داده می‌شود + injector/appRef مربوط به آن */
interface RenderTarget {
  doc: Document;
  /** document ی غیر از document اپ اصلی (مثلاً iframe بوم) */
  foreign: boolean;
  /** env ی ثبت‌شده برای document خارجی (registerDocument) */
  registeredEnv?: EnvironmentInjector;
  /** env ی که بلاک باید از آن resolve شود: اپ iframe یا اپ اصلی */
  environment: EnvironmentInjector;
  appRef: ApplicationRef;
}

const NOT_FOUND = Symbol('NOT_FOUND');

/**
 * Injector ی بلاک (elementInjector). ترتیب resolve:
 *   1) overrides  → DOCUMENT / RendererFactory2 / EnvironmentInjector ی همان document
 *   2) scope      → فقط providerهایی که خود کامپوننت تعریف کرده (+ COMPONENT_DATA)
 *   3) fallback   → env اپ iframe (یا اپ اصلی اگر بلاک در document اصلی است)
 *
 * نکته: scope عمداً parent اپ اصلی دارد (پنل تنظیمات هم از همان استفاده می‌کند)،
 * ولی با `{ self: true }` فقط providerهای خودش را می‌دهد؛ پس سرویس‌های اپ اصلی روی اپ iframe سایه نمی‌اندازند.
 */
class BlockInjector implements Injector {
  constructor(
    private readonly scope: Injector | undefined,
    private readonly fallback: Injector,
    private readonly overrides: ReadonlyMap<unknown, unknown>,
  ) {}

  get(token: any, notFoundValue?: any, options?: any): any {
    if (this.overrides.has(token)) return this.overrides.get(token);
    if (this.scope && token !== Injector) {
      const own = this.scope.get(token, NOT_FOUND as any, { self: true });
      if (own !== (NOT_FOUND as any)) return own;
    }
    return this.fallback.get(token, notFoundValue, options);
  }
}

/** Host component used to let Angular instantiate dynamic directives on an existing element. */
@Component({ standalone: true, template: '' })
class DynamicDirectiveHostComponent {}

/** متادیتای input/output هر تایپ فقط یک‌بار محاسبه می‌شود */
const memberTables = new WeakMap<object, MemberTable>();

function buildMemberTable(type: any): MemberTable {
  // ɵcmp / ɵdir: inputs = { [publicName]: privateName | [privateName, flags, ...] }
  // این API داخلی Angular است و فقط همین‌جا استفاده می‌شود.
  const def = type?.ɵcmp ?? type?.ɵdir;
  const toPrivate = (meta: any): string => (Array.isArray(meta) ? meta[0] : meta);
  const build = (map: Record<string, any> | undefined): Map<string, MemberInfo> => {
    const table = new Map<string, MemberInfo>();
    if (!map) return table;
    const entries = Object.entries(map);
    for (const [publicName, meta] of entries) {
      table.set(publicName, { publicName, privateName: toPrivate(meta) });
    }
    // lookup با نام property (فقط اگر با یک نام عمومی تداخل نداشته باشد)
    for (const [publicName, meta] of entries) {
      const privateName = toPrivate(meta);
      if (!table.has(privateName)) table.set(privateName, { publicName, privateName });
    }
    return table;
  };
  return { inputs: build(def?.inputs), outputs: build(def?.outputs) };
}

function memberTable(type: any): MemberTable {
  if (!type || (typeof type !== 'function' && typeof type !== 'object')) {
    return { inputs: new Map(), outputs: new Map() };
  }
  let table = memberTables.get(type);
  if (!table) {
    table = buildMemberTable(type);
    memberTables.set(type, table);
  }
  return table;
}

const asHost = (el: HTMLElement) => el as BlockHostElement;

// ───────────────────────── service ─────────────────────────

@Injectable({ providedIn: 'root' })
export class DynamicElementService {
  public dynamicData?: DynamicDataStructure;

  private readonly doc = inject(DOCUMENT);
  private readonly appRef = inject(ApplicationRef);
  private readonly envInjector = inject(EnvironmentInjector);
  private readonly renderer: Renderer2 = inject(RendererFactory2).createRenderer(null, null);

  /**
   * هر document ی (مثلاً iframe بوم ادیتور) که یک Angular Application جداگانه دارد.
   * Angular استایل هر کامپوننت را از طریق RendererFactory2 در <head> ی همان document می‌نویسد؛
   * پس بلاکی که داخل iframe نمایش داده می‌شود باید RendererFactory2 (و DOCUMENT) همان iframe را بگیرد.
   */
  private readonly documentInjectors = new WeakMap<Document, EnvironmentInjector>();
  private readonly warnedDocuments = new WeakSet<Document>();

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
    const parentEl = this.getParentElement(container);

    if (item.customComponent) {
      const element = await this.createComponentElement(sourceItemList, editMode, parentEl, item, index);
      // directive های کامپوننت داخل createComponent وصل شده‌اند؛ اینجا attribute / event / class
      this.bindOptions(element, item);
      item.el = element;
      return element;
    }

    if (!item.tag) item.tag = 'div';
    const element = this.createElementIn(parentEl.ownerDocument ?? this.doc, item.tag);
    this.insertAt(parentEl, element, index);
    try {
      // محتوا قبل از directive ها: فرزندان در attachDirectivesToElement حفظ می‌شوند
      if (item.content) this.renderer.setProperty(element, 'innerHTML', item.content);
      // Bind options و directives (باید بعد از قرار گرفتن در DOM صدا زده شود)
      this.bindOptions(element, item);
    } catch (error) {
      this.releaseElement(element);
      element.parentNode?.removeChild(element);
      throw error;
    }

    item.el = element;
    return element;
  }

  updateElementContent(data: PageItem) {
    if (!data.el) return data.el;
    this.renderer.setProperty(data.el, 'innerHTML', data.content);
    return data.el;
  }

  /**
   * ورودی‌های یک بلاک کامپوننت را درجا تغییر می‌دهد (بدون destroy/create).
   * ورودی‌ها signal هستند، پس Angular خودش ngOnChanges و به‌روزرسانی template را انجام می‌دهد.
   */
  public setInputs(item: PageItem, inputs: Record<string, unknown>): void {
    const el = item.el ? asHost(item.el) : undefined;
    const compRef = el?.__componentRef__;
    const signals = el?.__inputSignals__;
    if (!compRef || !signals) return;

    let changed = false;
    for (const [name, value] of Object.entries(inputs)) {
      const info = this.getInputInfo(compRef.componentType, name);
      const sig = signals.get(info?.publicName ?? name);
      if (sig) {
        if (!Object.is(sig(), value)) {
          sig.set(value);
          changed = true;
        }
      } else {
        this.assignLegacyProperty(compRef, name, value, true);
      }
    }
    if (changed) compRef.changeDetectorRef.detectChanges();
  }

  private async createComponentElement(
    sourceItemList: SourceItem[],
    editMode: boolean,
    parentEl: HTMLElement,
    item: PageItem,
    index: number | null,
  ): Promise<HTMLElement> {
    const component = await item.getComponentInstance(sourceItemList);
    if (!component) {
      console.warn('Not exist custom component:', item.customComponent);
      throw new Error('Not exist custom component');
    }

    const customComponent = item.customComponent!;
    // document ی که بلاک قرار است در آن نمایش داده شود (در ادیتور: iframe بوم)
    const target = this.resolveTarget(parentEl.ownerDocument ?? this.doc);
    if (target.foreign && !target.registeredEnv && !this.warnedDocuments.has(target.doc)) {
      this.warnedDocuments.add(target.doc);
      console.warn(
        'DynamicElementService: the target document has no registered Angular application. ' +
          'Call registerDocument(doc, envInjector) so component styles / services belong to the iframe app.',
      );
    }

    // دریافت تغییرات تنظیمات داده‌های کامپوننت سفارشی
    const onChangeCustomData = new Subject<any>();
    onChangeCustomData.subscribe((value) => {
      customComponent.componentData = value;
    });

    const context: ComponentDataContext = {
      // getter: بلاک و پنل تنظیمات همیشه آخرین مقدار را می‌بینند
      get data() {
        return customComponent.componentData;
      },
      onChange: onChangeCustomData,
    } as ComponentDataContext;

    // Scope ی کامپوننت: providerهای خودش + COMPONENT_DATA.
    // parent = اپ اصلی ⇒ پنل تنظیمات (در اپ اصلی) هم می‌تواند از همین injector استفاده کند
    // و دقیقاً همان instance ی سرویس‌هایی را ببیند که بلاک داخل iframe می‌بیند.
    const scope = createEnvironmentInjector(
      [...(customComponent.providers ?? []), { provide: COMPONENT_DATA, useValue: context } as Provider],
      this.envInjector,
      'DynamicBlockScope',
    );
    customComponent.compInjector = scope;

    // injector ی خودِ بلاک: scope → (DOCUMENT / RendererFactory2 ی iframe) → اپ iframe
    const blockInjector = new BlockInjector(scope, target.environment, this.createOverrides(target));

    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      onChangeCustomData.complete();
      try {
        scope.destroy();
      } catch {
        /* already destroyed */
      }
      if (customComponent.compInjector === scope) {
        customComponent.compInjector = undefined as any;
      }
    };

    let compRef: ComponentRef<any> | undefined;
    let element: BlockHostElement | undefined;
    try {
      // ⚠️ Angular اجازه نمی‌دهد در یک ComponentRef که inputBinding دارد (مثلاً به‌خاطر directive های دارای binding)
      // از setInput استفاده شود (NG0317). پس همه‌ی ورودی‌ها با inputBinding و روی یک signal داده می‌شوند
      // (تغییر بعدی: setInputs).
      const inputSignals = new Map<string, WritableSignal<unknown>>();
      const bindings: any[] = [];
      const legacyValues: Array<[string, any, boolean]> = [];

      const componentInputs: Array<[string, any]> = [
        ['pageItem', item],
        ['editMode', editMode],
        ...Object.entries(item.options?.inputs ?? {}),
      ];
      for (const [name, value] of componentInputs) {
        const info = this.getInputInfo(component, name);
        if (info) {
          const sig = signal<unknown>(value);
          inputSignals.set(info.publicName, sig);
          bindings.push(inputBinding(info.publicName, sig));
        } else {
          // pageItem / editMode ممکن است ورودی تعریف‌شده نباشند؛ فقط برای ورودی‌های کاربر warn می‌دهیم
          legacyValues.push([name, value, name !== 'pageItem' && name !== 'editMode']);
        }
      }

      // Outputs: EventEmitter / output() / model() — Angular خودش subscribe/unsubscribe می‌کند
      for (const [key, handler] of Object.entries(item.options?.outputs ?? {})) {
        const info = this.getOutputInfo(component, key);
        if (info) {
          bindings.push(outputBinding(info.publicName, (value: any) => (handler as any)(value)));
        } else {
          console.warn(`'${key}' is not an Angular output on ${component.name}`);
        }
      }

      compRef = createComponent(component, {
        elementInjector: blockInjector,
        environmentInjector: target.environment,
        bindings,
        directives: this.buildDirectiveBindings(item.options?.directives),
      });
      target.appRef.attachView(compRef.hostView);
      compRef.onDestroy(dispose);

      element = compRef.location.nativeElement as BlockHostElement;
      element.__componentRef__ = compRef;
      element.__viewApplicationRef__ = target.appRef;
      element.__inputSignals__ = inputSignals;
      // قبل از اولین change detection در DOM قرار می‌گیرد (directive ها مثل drag&drop به DOM نیاز دارند)
      this.insertAt(parentEl, element, index);

      for (const [name, value, warn] of legacyValues) {
        this.assignLegacyProperty(compRef, name, value, warn);
      }

      // اولین چرخه‌ی change detection: ngOnChanges / ngOnInit / ngAfterViewInit
      // (هم برای کامپوننت و هم برای directive های متصل به آن)
      compRef.changeDetectorRef.detectChanges();

      return element;
    } catch (error) {
      if (compRef) {
        try {
          target.appRef.detachView(compRef.hostView);
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
      dispose();
      throw error;
    }
  }

  //--------------------------------------------------------------------------------------------------------------
  /**
   * ## Must be call after insert to dom
   */
  private bindOptions(element: HTMLElement, item: PageItem): HTMLElement {
    if (!element || !item) return element;
    if (item.options?.attributes) {
      for (const [k, v] of Object.entries(item.options.attributes)) {
        this.applyAttribute(element, k, v);
      }
    }

    // For plain HTML elements, create an Angular host view for dynamic directives.
    // Custom component directives were attached during createComponent.
    if (item.options?.directives?.length && !asHost(element).__componentRef__) {
      this.attachDirectivesToElement(element, item.options.directives);
    }

    if (item.options?.events) {
      const eventCleanups: Array<() => void> = [];
      for (const [k, v] of Object.entries(item.options.events)) {
        const cleanup = this.renderer.listen(element, k, v as (event: Event) => void);
        if (typeof cleanup === 'function') eventCleanups.push(cleanup);
      }
      if (eventCleanups.length) {
        asHost(element).__eventCleanups__ = eventCleanups;
      }
    }

    if (element.tagName == 'IMG' && !element.hasAttribute('src')) {
      element.setAttribute('src', DEFAULT_IMAGE_URL);
    }

    if (element.tagName == 'A' && Array.isArray(item.options?.customData?.queryString)) {
      this.applyLinkQueryString(element, item.options.customData.queryString as CMSPageQueryString[]);
    }

    if (item.id != null) {
      element.setAttribute('data-id', String(item.id));
    }

    if (item.classList?.length) {
      element.classList.add(...item.classList);
    }

    return element;
  }

  /** set / remove one HTML attribute */
  private applyAttribute(element: HTMLElement, name: string, value: unknown): void {
    // HTML boolean attributes are enabled by presence; data/custom attributes keep literal values.
    const isBoolean = BOOLEAN_HTML_ATTRIBUTES.has(name.toLowerCase());
    if (value === null || value === undefined || (isBoolean && value === false)) {
      this.renderer.removeAttribute(element, name);
    } else if (isBoolean && value === true) {
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
   * (attributes, text content, css classes, link query string, component inputs, data source, style reference).
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

    // component inputs
    if (isComponent && next.options?.inputs) {
      this.setInputs(item, next.options.inputs);
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
    if (isComponent && next.options?.inputs) item.options.inputs = { ...next.options.inputs };
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
   * ngOnChanges / ngOnInit همین‌جا (بعد از قرار گرفتن المنت در DOM) و ngOnDestroy در releaseElement صدا زده می‌شوند.
   */
  private attachDirectivesToElement(element: HTMLElement, directives: Directive[]): void {
    const host = asHost(element);
    if (!directives?.length || host.__directiveHostRef__) return;

    const target = this.resolveTarget(element.ownerDocument ?? this.doc);
    const elementInjector = target.foreign
      ? new BlockInjector(undefined, target.environment, this.createOverrides(target))
      : undefined;

    // createComponent({hostElement}) محتوای المنت را پاک می‌کند؛ پس فرزندان را نگه می‌داریم و برمی‌گردانیم.
    const preservedNodes = Array.from(element.childNodes);

    const directiveHostRef = createComponent(DynamicDirectiveHostComponent, {
      hostElement: element,
      environmentInjector: target.environment,
      ...(elementInjector ? { elementInjector } : {}),
      directives: this.buildDirectiveBindings(directives),
    });

    for (const node of preservedNodes) {
      element.appendChild(node);
    }

    host.__directiveHostRef__ = directiveHostRef;
    host.__viewApplicationRef__ = target.appRef;

    target.appRef.attachView(directiveHostRef.hostView);

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

  private getInputInfo(type: any, name: string): MemberInfo | null {
    return memberTable(type).inputs.get(name) ?? null;
  }

  private getOutputInfo(type: any, name: string): MemberInfo | null {
    return memberTable(type).outputs.get(name) ?? null;
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
   * Idempotent: a second call does nothing.
   */
  private releaseElement(el: HTMLElement): void {
    const host = asHost(el);
    const refs: ComponentRef<any>[] = [];
    if (host.__componentRef__) refs.push(host.__componentRef__);
    if (host.__directiveHostRef__) refs.push(host.__directiveHostRef__);

    const appRef = host.__viewApplicationRef__ ?? this.appRef;
    const eventCleanups = host.__eventCleanups__;

    // قبل از destroy، property ها را پاک می‌کنیم تا destroy مجدد باعث دوبار صدا خوردن hook ها نشود
    delete host.__componentRef__;
    delete host.__directiveHostRef__;
    delete host.__viewApplicationRef__;
    delete host.__inputSignals__;
    delete host.__eventCleanups__;

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

    if (eventCleanups) {
      for (const cleanup of eventCleanups) {
        try {
          cleanup();
        } catch (error) {
          console.warn('Event listener cleanup failed:', error);
        }
      }
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

  private resolveTarget(doc: Document): RenderTarget {
    const foreign = doc !== this.doc;
    const registeredEnv = foreign ? this.documentInjectors.get(doc) : undefined;
    return {
      doc,
      foreign,
      registeredEnv,
      environment: registeredEnv ?? this.envInjector,
      appRef: this.getAppRef(registeredEnv),
    };
  }

  /**
   * Angular ریندرر / DOCUMENT را از elementInjector می‌گیرد (قبل از environmentInjector)،
   * پس برای document خارجی (iframe) باید همین‌جا override شوند.
   */
  private createOverrides(target: RenderTarget): Map<unknown, unknown> {
    const overrides = new Map<unknown, unknown>([[EnvironmentInjector, target.environment]]);
    if (target.foreign) {
      overrides.set(DOCUMENT, target.doc);
      if (target.registeredEnv) {
        overrides.set(RendererFactory2, target.registeredEnv.get(RendererFactory2));
      }
    }
    return overrides;
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
}
