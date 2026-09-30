import { DOCUMENT, inject, Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import {
  ICssVariable,
  IStyleSheetFile,
  LibConsts,
  PageItem,
  parseCssBlockToRecord,
  BlockCss,
  BlockCssChunk,
  Breakpoint,
  PseudoState,
  DEFAULT_BREAKPOINTS,
  type BreakPointKey,
} from 'ngx-page-builder/core';

/** تایپ حداقلی برای rule هایی که insertRule/deleteRule/cssRules دارند (CSSMediaRule و CSSLayerBlockRule) — چون lib.dom.ts فعلی TS ممکن است CSSLayerBlockRule را نشناسد */
interface GroupingRule extends CSSRule {
  cssRules: CSSRuleList;
  insertRule(rule: string, index?: number): number;
  deleteRule(index: number): void;
}

export interface ICssFile {
  id: string;
  name: string;
  data: Record<string, string>;
  isImportedPublicCss: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** آیا این فایل به‌صورت خام (بدون parse) باید اضافه بشه؟ */
  isRawCss?: boolean;
  /** محتوای خام CSS برای فایل‌های public */
  rawContent?: string;
}

interface IClassInfo {
  selector: string;
  cssText: string;
  fileName: string;
  fileId: string;
}

/** رفرنس‌های zinde به rule های مربوط به یک node (بدون هیچ ایندکس عددی) */
interface NodeStyleRefs {
  base?: CSSStyleRule;
  states: Map<PseudoState, CSSStyleRule>;
  breakpoints: Map<BreakPointKey, { base?: CSSStyleRule; states: Map<PseudoState, CSSStyleRule> }>;
}

const VALID_IDENT = /(sm|md|lg|xl|xxl)/;

//====================================================================================

@Injectable({
  providedIn: 'root',
})
export class ClassManagerService {
  private cssFilesSubject = new BehaviorSubject<ICssFile[]>([]);
  public cssFiles$ = this.cssFilesSubject.asObservable();

  private availableClassesSubject = new BehaviorSubject<string[]>([]);
  public availableClasses$ = this.availableClassesSubject.asObservable();

  public cssFileData: ICssFile[] = [];

  /** استایل‌شیت مربوط به کلاس‌های سفارشی و بلاک‌ها (لایه‌ی files + blocks) */
  private styleElement: HTMLStyleElement | null = null;
  private styleSheet: CSSStyleSheet | null = null;

  /** استایل‌شیت CSS های عمومی وارداتی مثل Bootstrap (لایه‌ی vendor) */
  private publicStyleElement: HTMLStyleElement | null = null;

  /** یک استایل خیلی کوچک که فقط ترتیب لایه‌ها را با اولین چیزی که پارس می‌شود اعلام می‌کند */
  private layerOrderElement: HTMLStyleElement | null = null;

  private isInitialized = false;

  /** iframe محتوای صفحه‌ساز — باید قبل از initialize() لود شده باشد */
  private iframe?: HTMLIFrameElement | null;

  /** کلاس‌های سفارشی کاربر (از addCssFile) — کلید = selector نرمال‌شده */
  private rulesMap = new Map<string, { rule: CSSStyleRule; fileId: string }>();

  /** استایل تولیدشده‌ی هر بلاک — کلید = item.id */
  private nodeRefs = new Map<string, NodeStyleRefs>();

  /** رفرنس به `@layer files {}` داخل styleSheet */
  private filesLayer?: GroupingRule;
  /** رفرنس به `@layer blocks {}` داخل styleSheet */
  private blocksLayer?: GroupingRule;

  /** رفرنس به `@media (min-width:..)` هر breakpoint، داخل blocksLayer، مرتب‌شده صعودی */
  private mediaRules: { key: string; minWidth: number; rule: GroupingRule }[] = [];

  private rootVarsRule?: CSSStyleRule;

  breakpoints: Breakpoint[] = DEFAULT_BREAKPOINTS;

  doc = inject(DOCUMENT);
  http = inject(HttpClient);

  private _cssVariables: ICssVariable[] = [];
  public get cssVariables(): ICssVariable[] {
    return this._cssVariables;
  }

  public setCssVariables(val: ICssVariable[]): void {
    this._cssVariables = val;
    if (!this.rootVarsRule) return;
    let cssText = '';
    for (const c of val) {
      cssText += `--${c.name}:${c.value};`;
    }
    this.rootVarsRule.style.cssText = cssText;
  }

  constructor() {
    this.initializeDefaultFile();
  }

  private initializeDefaultFile(): void {
    const defaultFile: ICssFile = {
      id: this.generateId(),
      name: 'default',
      data: {
        '*': 'box-sizing:border-box',
        img: `max-width:100%`,
        pre: 'white-space: pre-wrap;font-family:inherit;',
      },
      isImportedPublicCss: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      isRawCss: false,
    };

    this.cssFileData.push(defaultFile);
    this.updateAvailableClasses();
    this.cssFilesSubject.next(this.cssFileData);
  }

  //==================================================================================
  // راه‌اندازی روی iframe
  //==================================================================================

  /**
   * اتصال سرویس به iframe محتوا.
   * چون iframe ممکنه هنوز لود نشده باشه، منتظر رویداد load می‌مانیم.
   */
  public setIframe(iframe: HTMLIFrameElement): void {
    this.iframe = iframe;
    const ready = iframe.contentDocument && iframe.contentDocument.readyState !== 'loading';
    if (ready) {
      this.initialize();
    } else {
      iframe.addEventListener(
        'load',
        () => {
          this.initialize();
        },
        { once: true },
      );
    }
  }

  public initialize(): void {
    if (this.isInitialized) return;

    const idoc = this.iframe?.contentDocument;
    if (!idoc) {
      console.warn('PageBuilder iframe document not ready');
      return;
    }

    const head = idoc.head ?? idoc.documentElement;

    // ۱. اعلام ترتیب لایه‌ها — باید اولین چیزی باشد که پارسر می‌بیند
    if (!this.layerOrderElement) {
      this.layerOrderElement = idoc.createElement('style');
      this.layerOrderElement.id = 'NgxPageBuilderLayerOrder';
      this.layerOrderElement.textContent = '@layer vendor, files, blocks;';
      head.insertBefore(this.layerOrderElement, head.firstChild);
    }

    // ۲. استایل‌شیت CSS های عمومی (Bootstrap و ...) — لایه vendor
    this.publicStyleElement = idoc.createElement('style');
    this.publicStyleElement.id = 'NgxPageBuilderPublicCSS';
    head.appendChild(this.publicStyleElement);

    // ۳. استایل‌شیت custom classes + بلاک‌ها — لایه files و blocks
    this.styleElement = idoc.createElement('style');
    this.styleElement.id = 'NgxPageBuilderClassUI';
    head.appendChild(this.styleElement);
    this.styleSheet = this.styleElement.sheet as CSSStyleSheet;

    // متغیرهای CSS: خارج از هر لایه (unlayered همیشه بر لایه‌ها اولویت دارد)
    const rootIdx = this.styleSheet.insertRule(':root{}', 0);
    this.rootVarsRule = this.styleSheet.cssRules[rootIdx] as CSSStyleRule;

    // لایه‌ی files (کلاس‌های دستی کاربر)
    const filesIdx = this.styleSheet.insertRule('@layer files{}', this.styleSheet.cssRules.length);
    this.filesLayer = this.styleSheet.cssRules[filesIdx] as unknown as GroupingRule;

    // لایه‌ی blocks (استایل تولیدی بلاک‌ها) — آخرین لایه = بالاترین اولویت
    const blocksIdx = this.styleSheet.insertRule('@layer blocks{}', this.styleSheet.cssRules.length);
    this.blocksLayer = this.styleSheet.cssRules[blocksIdx] as unknown as GroupingRule;

    this.isInitialized = true;

    // بارگذاری فایل‌های از قبل موجود (مثلاً بعد از باز کردن مجدد سند)
    for (const file of this.cssFileData) {
      if (file.isRawCss) {
        this.loadRawCssFile(file);
      } else if (file.name !== 'default' || Object.keys(file.data).length) {
        this.loadFileRules(file);
      }
    }
    if (this._cssVariables.length) this.setCssVariables(this._cssVariables);

    this.importPublicCss();
  }

  public destroy(): void {
    this.layerOrderElement?.parentNode?.removeChild(this.layerOrderElement);
    this.styleElement?.parentNode?.removeChild(this.styleElement);
    this.publicStyleElement?.parentNode?.removeChild(this.publicStyleElement);

    this.layerOrderElement = null;
    this.styleElement = null;
    this.publicStyleElement = null;
    this.styleSheet = null;
    this.filesLayer = undefined;
    this.blocksLayer = undefined;
    this.mediaRules = [];
    this.rootVarsRule = undefined;
    this.rulesMap.clear();
    this.nodeRefs.clear();
    this.cssFileData = [];
    this.isInitialized = false;

    this.cssFilesSubject.next([]);
    this.availableClassesSubject.next([]);
  }

  //==================================================================================
  // CSS عمومی وارداتی (Bootstrap و ...) — لایه vendor، به‌صورت متن خام
  //==================================================================================

  importPublicCss(): void {
    if (!this.isInitialized) return;
    for (const css of LibConsts.publicCss) {
      if (this.cssFileData.some((f) => f.isImportedPublicCss && f.rawContent !== undefined)) continue;
      const fileName = css.split('/').pop()?.split('.')?.[0] ?? 'default';
      this.http.get(css, { responseType: 'text', headers: { accept: 'text/plain' } }).subscribe({
        next: (content) => {
          if (content && typeof content === 'string') {
            this.addCssFileHybrid(fileName, content, true);
          }
        },
        error: (err) => console.warn('Import css file:', err),
      });
    }
  }

  /**
   * بارگذاری فایل CSS خام (بوت‌استرپ و مشابه): متن کامل، بدون parse تک‌تک rule ها.
   * فقط برای autocomplete نام کلاس‌ها extract سبک انجام می‌شود.
   */
  public async addCssFileHybrid(name: string, content: string, isPublicFile = false): Promise<ICssFile> {
    name = this.validateName(name);
    const extractedClasses = this.extractClassNames(content);

    const newFile: ICssFile = {
      id: this.generateId(),
      name,
      data: extractedClasses,
      createdAt: new Date(),
      updatedAt: new Date(),
      isImportedPublicCss: isPublicFile,
      isRawCss: true,
      rawContent: content,
    };

    this.cssFileData.push(newFile);
    this.updateAvailableClasses();
    this.cssFilesSubject.next(this.cssFileData);

    if (this.isInitialized) this.loadRawCssFile(newFile);
    return newFile;
  }

  private extractClassNames(cssContent: string): Record<string, string> {
    const classes: Record<string, string> = {};
    const cleanContent = cssContent.replace(/\/\*[\s\S]*?\*\//g, '');
    const classRegex = /\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)(?![^\(]*\))(?::[a-zA-Z]+)?/g;
    let match;
    while ((match = classRegex.exec(cleanContent)) !== null) {
      const className = match[1];
      if (!classes[`.${className}`]) classes[`.${className}`] = '';
    }
    return classes;
  }

  /** بارگذاری فایل خام داخل لایه vendor (به‌صورت append؛ حذف/آپدیت با reloadAllRawFiles) */
  private loadRawCssFile(file: ICssFile): void {
    if (!file.isRawCss || !file.rawContent || !this.publicStyleElement) return;
    const wrapped = `@layer vendor {\n/* ${file.name} */\n${file.rawContent}\n}\n`;
    this.publicStyleElement.textContent = (this.publicStyleElement.textContent ?? '') + wrapped;
  }

  private reloadAllRawFiles(): void {
    if (!this.publicStyleElement) return;
    this.publicStyleElement.textContent = '';
    for (const file of this.cssFileData) {
      if (file.isRawCss && file.rawContent) this.loadRawCssFile(file);
    }
  }

  //==================================================================================
  // کلاس‌های سفارشی کاربر (فایل‌های parse‌شده، نه raw) — لایه files
  //==================================================================================

  public async addCssFile(name: string, content: string, isPublicFile = false): Promise<ICssFile> {
    name = this.validateName(name);
    const data = await parseCssBlockToRecord(content);

    const newFile: ICssFile = {
      id: this.generateId(),
      name,
      data,
      createdAt: new Date(),
      updatedAt: new Date(),
      isImportedPublicCss: isPublicFile,
      isRawCss: false,
    };

    this.cssFileData.push(newFile);
    this.updateAvailableClasses();
    this.cssFilesSubject.next(this.cssFileData);

    if (this.isInitialized) this.loadFileRules(newFile);
    return newFile;
  }

  public async addToDefaultStyles(content: string): Promise<void> {
    const defaultFile = this.cssFileData.find((f) => f.name === 'default');
    if (defaultFile) {
      await this.updateCssFile(defaultFile.id, content, false);
    } else {
      await this.addCssFile('default', content);
    }
  }

  public async updateCssFile(fileId: string, content: string | Record<string, string>, replace = true): Promise<void> {
    const file = this.cssFileData.find((f) => f.id === fileId);
    if (!file) throw new Error(`File with id ${fileId} not found`);

    if (file.isRawCss) {
      if (typeof content !== 'string') throw new Error('File css Content must be string');
      file.rawContent = content;
      file.data = this.extractClassNames(content);
      file.updatedAt = new Date();
      this.updateAvailableClasses();
      this.cssFilesSubject.next(this.cssFileData);
      if (this.isInitialized) this.reloadAllRawFiles();
      return;
    }

    const data = typeof content === 'string' ? await parseCssBlockToRecord(content) : content;

    if (replace) {
      this.removeFileRules(fileId);
      file.data = data;
    } else {
      file.data = Object.assign(file.data, data);
    }
    file.updatedAt = new Date();

    this.updateAvailableClasses();
    this.cssFilesSubject.next(this.cssFileData);

    if (this.isInitialized) this.loadFileRules(file);
  }

  public removeCssFile(fileId: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      try {
        const idx = this.cssFileData.findIndex((f) => f.id === fileId);
        if (idx === -1) throw new Error('File not found');

        const file = this.cssFileData[idx];
        this.cssFileData.splice(idx, 1);

        if (file.isRawCss) {
          this.reloadAllRawFiles();
        } else {
          this.removeFileRules(fileId);
        }

        this.updateAvailableClasses();
        this.cssFilesSubject.next(this.cssFileData);
        resolve(true);
      } catch (error) {
        reject(error);
      }
    });
  }

  public renameCssFile(fileId: string, newName: string): void {
    const file = this.cssFileData.find((f) => f.id === fileId);
    if (!file) return;
    file.name = this.validateName(newName, fileId);
    file.updatedAt = new Date();
    this.cssFilesSubject.next(this.cssFileData);
  }

  public getCssFile(fileId: string): ICssFile | undefined {
    return this.cssFileData.find((f) => f.id === fileId);
  }

  public getAllCssFiles(): ICssFile[] {
    return [...this.cssFileData];
  }

  private loadFileRules(file: ICssFile): void {
    if (!this.filesLayer || file.isRawCss) return;
    for (const [selector, cssText] of Object.entries(file.data)) {
      this.insertNamedRule(selector, cssText, file.id);
    }
  }

  private removeFileRules(fileId: string): void {
    if (!this.filesLayer) return;
    const toRemove: string[] = [];
    this.rulesMap.forEach((v, selector) => {
      if (v.fileId === fileId) toRemove.push(selector);
    });
    for (const selector of toRemove) this.removeNamedRule(selector);
  }

  private insertNamedRule(selector: string, cssText: string, fileId: string): void {
    if (!this.filesLayer) return;
    try {
      const normalized = this.normalizeSelector(selector);
      const existing = this.rulesMap.get(normalized);
      if (existing) {
        existing.rule.style.cssText = cssText;
        return;
      }
      const idx = this.filesLayer.insertRule(`${normalized} { ${cssText} }`, this.filesLayer.cssRules.length);
      const rule = this.filesLayer.cssRules[idx] as CSSStyleRule;
      this.rulesMap.set(normalized, { rule, fileId });
    } catch (e) {
      console.debug(`Could not insert rule ${selector}:`, e);
    }
  }

  private removeNamedRule(selector: string): void {
    if (!this.filesLayer) return;
    const normalized = this.normalizeSelector(selector);
    const existing = this.rulesMap.get(normalized);
    if (!existing) return;
    this.deleteRuleRef(this.filesLayer, existing.rule);
    this.rulesMap.delete(normalized);
  }

  /** حذف یک rule با پیدا کردن ایندکس واقعی‌اش لحظه‌ی حذف (بدون نگه‌داری ایندکس قدیمی/شکننده) */
  private deleteRuleRef(container: GroupingRule, rule: CSSRule): void {
    const idx = Array.prototype.indexOf.call(container.cssRules, rule);
    if (idx > -1) {
      try {
        container.deleteRule(idx);
      } catch (e) {
        console.error('Error deleting rule:', e);
      }
    }
  }

  /**
   * TODO: چانک درست (item.css.base یا item.css.states.hover یا item.css.breakpoints.md.base) بنویسند و بعد addBlockCss(item) را صدا بزنند.
   */
  public updateClass(selector: string, styles: Partial<CSSStyleDeclaration> | string, fileId?: string): void {
    if (!this.filesLayer) {
      console.warn('StyleSheet not initialized. Call initialize() first.');
      return;
    }
    const cssText = typeof styles === 'string' ? styles : this.styleObjectToString(styles);
    const normalized = this.normalizeSelector(selector);
    const targetFileId = fileId || this.rulesMap.get(normalized)?.fileId || this.cssFileData[0]?.id;
    if (!targetFileId) {
      console.error('No file available to add class');
      return;
    }
    this.insertNamedRule(normalized, cssText, targetFileId);

    const file = this.cssFileData.find((f) => f.id === targetFileId);
    if (file && !file.isRawCss) {
      file.data[normalized] = cssText;
      file.updatedAt = new Date();
      this.updateAvailableClasses();
      this.cssFilesSubject.next(this.cssFileData);
    }
  }

  public updateClassImmediate(selector: string, styles: Partial<CSSStyleDeclaration> | string, fileId?: string): void {
    requestAnimationFrame(() => this.updateClass(selector, styles, fileId));
  }

  public updateClasses(classes: Record<string, Partial<CSSStyleDeclaration> | string>, fileId?: string): void {
    requestAnimationFrame(() => {
      for (const [selector, styles] of Object.entries(classes)) this.updateClass(selector, styles, fileId);
    });
  }

  public removeClass(selector: string): void {
    const normalized = this.normalizeSelector(selector);
    const existing = this.rulesMap.get(normalized);
    if (!existing) return;
    this.removeNamedRule(normalized);
    const file = this.cssFileData.find((f) => f.id === existing.fileId);
    if (file && !file.isRawCss) {
      delete file.data[normalized];
      file.updatedAt = new Date();
      this.updateAvailableClasses();
      this.cssFilesSubject.next(this.cssFileData);
    }
  }

  public renameClass(oldSelector: string, newSelector: string): void {
    const normalizedOld = this.normalizeSelector(oldSelector);
    const normalizedNew = this.normalizeSelector(newSelector);
    if (normalizedOld === normalizedNew) return;

    const existing = this.rulesMap.get(normalizedOld);
    if (!existing) return;
    const cssText = existing.rule.style.cssText;

    this.removeNamedRule(normalizedOld);
    this.insertNamedRule(normalizedNew, cssText, existing.fileId);

    const file = this.cssFileData.find((f) => f.id === existing.fileId);
    if (file && !file.isRawCss) {
      delete file.data[normalizedOld];
      file.data[normalizedNew] = cssText;
      file.updatedAt = new Date();
      this.updateAvailableClasses();
      this.cssFilesSubject.next(this.cssFileData);
    }
  }

  public getClassStyles(selector: string): string | null {
    const normalized = this.normalizeSelector(selector);
    return this.rulesMap.get(normalized)?.rule.style.cssText ?? null;
  }

  public getClassInfo(selector: string): IClassInfo | null {
    const normalized = this.normalizeSelector(selector);
    const existing = this.rulesMap.get(normalized);
    if (!existing) return null;
    const file = this.cssFileData.find((f) => f.id === existing.fileId);
    return {
      selector: normalized,
      cssText: existing.rule.style.cssText,
      fileName: file?.name || 'unknown',
      fileId: existing.fileId,
    };
  }

  public hasClass(selector: string): boolean {
    return this.rulesMap.has(this.normalizeSelector(selector));
  }

  public get rulesCount(): number {
    return this.rulesMap.size;
  }

  //==================================================================================
  // استایل بلاک‌ها (per-node) — پایه + حالت‌ها + breakpointها — لایه blocks
  //==================================================================================

  /**
   * کلاس تولیدی بلاک را تضمین می‌کند و برمی‌گرداند.
   * توجه: کلاس دیگر به tag وابسته نیست (blk-id)، پس تغییر تگ (changeElementTagName)
   * دیگر نیازی به rename کلاس ندارد.
   */
  private ensureBlockClassName(item: PageItem): string {
    let cls = item.classList?.find((c) => c.startsWith('blk-'));
    if (!cls) {
      cls = `blk-${item.id}`;
      item.classList ??= [];
      item.classList.push(cls);
    }
    return cls;
  }

  private getOrCreateMediaRule(bpKey: string): GroupingRule | undefined {
    if (!this.blocksLayer) return undefined;
    const existing = this.mediaRules.find((m) => m.key === bpKey);
    if (existing) return existing.rule;

    const bp = this.breakpoints.find((b) => b.key === bpKey);
    if (!bp) {
      console.warn(`Unknown breakpoint: ${bpKey}`);
      return undefined;
    }

    // موقعیت درج: صعودی بر اساس minWidth (mobile-first)
    let insertAt = this.blocksLayer.cssRules.length;
    let listInsertAt = this.mediaRules.length;
    for (let i = 0; i < this.mediaRules.length; i++) {
      if (this.mediaRules[i].minWidth > bp.minWidth) {
        insertAt = Array.prototype.indexOf.call(this.blocksLayer.cssRules, this.mediaRulesRuleAt(i));
        listInsertAt = i;
        break;
      }
    }

    const idx = this.blocksLayer.insertRule(`@media (min-width:${bp.minWidth}px){}`, insertAt);
    const rule = this.blocksLayer.cssRules[idx] as unknown as GroupingRule;
    this.mediaRules.splice(listInsertAt, 0, { key: bpKey, minWidth: bp.minWidth, rule });
    return rule;
  }

  private mediaRulesRuleAt(i: number): CSSRule {
    return this.mediaRules[i].rule as unknown as CSSRule;
  }

  private upsertStyleRule(
    container: GroupingRule,
    selector: string,
    cssText: string | undefined,
    existing?: CSSStyleRule,
  ): CSSStyleRule | undefined {
    if (!cssText || !cssText.trim()) {
      if (existing) this.deleteRuleRef(container, existing);
      return undefined;
    }
    if (existing) {
      existing.style.cssText = cssText;
      return existing;
    }
    try {
      const idx = container.insertRule(`${selector} { ${cssText} }`, container.cssRules.length);
      return container.cssRules[idx] as CSSStyleRule;
    } catch (e) {
      console.warn(`Could not insert block rule for ${selector}:`, e);
      return undefined;
    }
  }

  private applyStates(
    container: GroupingRule,
    selector: string,
    input: Partial<Record<PseudoState, string>> | undefined,
    refs: Map<PseudoState, CSSStyleRule>,
  ): void {
    const incoming = input ?? {};
    const allStates = new Set<PseudoState>([...refs.keys(), ...(Object.keys(incoming) as PseudoState[])]);
    for (const state of allStates) {
      const rule = this.upsertStyleRule(container, `${selector}:${state}`, incoming[state], refs.get(state));
      if (rule) refs.set(state, rule);
      else refs.delete(state);
    }
  }

  /**
   * اعمال استایل یک بلاک (و بازگشتی روی فرزندان/template که css دارند).
   * جایگزین addBlockCss قدیمی. برای سازگاری، item.css می‌تواند string (فقط base) یا BlockCss باشد.
   */
  public async addBlockCss(item: PageItem): Promise<void> {
    if (!item) return;
    if (!this.blocksLayer) {
      console.warn('ClassManagerService not initialized yet');
      return;
    }

    if (item.css) {
      const chunk: BlockCss = typeof item.css === 'string' ? { base: item.css } : (item.css as BlockCss);
      this.applyBlockStyle(item, chunk);
    }

    if (item.children) {
      for (const child of item.children) {
        if (child.css) await this.addBlockCss(child);
      }
    }
    if (item.template?.css) {
      await this.addBlockCss(item.template);
    }
  }

  private applyBlockStyle(item: PageItem, chunk: BlockCss): void {
    if (!this.blocksLayer) return;
    const selector = '.' + this.ensureBlockClassName(item);

    let refs = this.nodeRefs.get(item.id);
    if (!refs) {
      refs = { states: new Map(), breakpoints: new Map() };
      this.nodeRefs.set(item.id, refs);
    }

    refs.base = this.upsertStyleRule(this.blocksLayer, selector, chunk.base, refs.base);
    this.applyStates(this.blocksLayer, selector, chunk.states, refs.states);

    const seenBp = new Set<BreakPointKey>();
    for (const k of Object.keys(chunk.breakpoints ?? {})) {
      const bpKey = k as BreakPointKey;
      if (!VALID_IDENT.test(bpKey)) continue;
      seenBp.add(bpKey);
      const media = this.getOrCreateMediaRule(bpKey);
      if (!media) continue;

      let bpRefs = refs.breakpoints.get(bpKey);
      if (!bpRefs) {
        bpRefs = { states: new Map() };
        refs.breakpoints.set(bpKey, bpRefs);
      }
      const c = chunk.breakpoints![bpKey];
      bpRefs.base = this.upsertStyleRule(media, selector, c.base, bpRefs.base);
      this.applyStates(media, selector, c.states, bpRefs.states);
    }

    // پاک‌سازی breakpointهایی که دیگر در ورودی نیستند
    for (const bpKey of Array.from(refs.breakpoints.keys())) {
      if (seenBp.has(bpKey)) continue;
      const media = this.mediaRules.find((m) => m.key === bpKey)?.rule;
      const bpRefs = refs.breakpoints.get(bpKey)!;
      if (media) {
        if (bpRefs.base) this.deleteRuleRef(media, bpRefs.base);
        for (const r of bpRefs.states.values()) this.deleteRuleRef(media, r);
      }
      refs.breakpoints.delete(bpKey);
    }
  }

  /** خواندن استایل فعلی یک بلاک برای پرکردن پنل تنظیمات (base/state/breakpoint فعال) */
  public getBlockCss(item: PageItem): BlockCss | undefined {
    const refs = this.nodeRefs.get(item.id);
    if (!refs) return undefined;

    const result: BlockCss = {};
    if (refs.base) result.base = refs.base.style.cssText;
    if (refs.states.size) {
      result.states = {};
      for (const [state, rule] of refs.states) result.states[state] = rule.style.cssText;
    }
    if (refs.breakpoints.size) {
      result.breakpoints = {} as any;
      for (const [bp, bpRefs] of refs.breakpoints) {
        const chunk: BlockCssChunk = {};
        if (bpRefs.base) chunk.base = bpRefs.base.style.cssText;
        if (bpRefs.states.size) {
          chunk.states = {};
          for (const [state, rule] of bpRefs.states) chunk.states[state] = rule.style.cssText;
        }
        result.breakpoints![bp] = chunk;
      }
    }
    return result;
  }

  /** حذف کامل استایل یک بلاک هنگام حذف بلاک از صفحه — این را از removeBlock در PageBuilderService صدا بزنید */
  public removeBlockCss(item: PageItem): void {
    const refs = this.nodeRefs.get(item.id);
    if (refs && this.blocksLayer) {
      if (refs.base) this.deleteRuleRef(this.blocksLayer, refs.base);
      for (const r of refs.states.values()) this.deleteRuleRef(this.blocksLayer, r);
      for (const [bpKey, bpRefs] of refs.breakpoints) {
        const media = this.mediaRules.find((m) => m.key === bpKey)?.rule;
        if (media) {
          if (bpRefs.base) this.deleteRuleRef(media, bpRefs.base);
          for (const r of bpRefs.states.values()) this.deleteRuleRef(media, r);
        }
      }
    }
    this.nodeRefs.delete(item.id);

    if (item.children) for (const c of item.children) this.removeBlockCss(c);
    if (item.template) this.removeBlockCss(item.template);
  }

  /** برای اسنپ‌شات گرفتن (پلاگین/thumbnail): فقط استایل پایه‌ی درخت، بدون media/pseudo */
  getBlockStyles(item: PageItem): string {
    let css = '';
    const tree = (node: PageItem) => {
      const refs = this.nodeRefs.get(node.id);
      if (refs?.base) {
        const cls = node.classList.find((c) => c.startsWith('blk-'));
        if (cls) css += `\n.${cls}{\n  ${refs.base.style.cssText}\n}\n`;
      }
      for (const c of node.classList) {
        const s = this.getClassStyles(c);
        if (s) css += `\n.${c}{\n  ${s}\n}\n`;
      }
      if (node.children) for (const child of node.children) tree(child);
    };
    tree(item);
    return css;
  }

  //==================================================================================
  // خروجی‌گیری برای ذخیره/انتشار
  //==================================================================================

  public exportFileCSS(fileId: string): string {
    const file = this.cssFileData.find((f) => f.id === fileId);
    if (!file) return '';
    if (file.isRawCss && file.rawContent) return file.rawContent;

    const rules: string[] = [];
    for (const selector of Object.keys(file.data)) {
      const cssText = this.getClassStyles(selector) ?? file.data[selector];
      if (cssText) rules.push(`${selector} { ${cssText} }`);
    }
    return rules.join('\n\n');
  }

  public exportAllFileCSS(): IStyleSheetFile[] {
    const files: IStyleSheetFile[] = [];
    for (const file of this.cssFileData) {
      if (file.isImportedPublicCss) continue;
      files.push({
        name: file.name,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        data: this.exportFileCSS(file.id),
      });
    }
    return files;
  }

  /** کل CSS تولیدشده (شامل @layer/@media/pseudo) — برای انتشار/دیباگ. سریالایز خودِ مرورگر از cssText استفاده می‌شود */
  public exportAllCSS(): string {
    if (!this.styleSheet) return '';
    try {
      let allCss = '';
      if (this.publicStyleElement?.textContent) allCss += this.publicStyleElement.textContent + '\n\n';
      allCss += Array.from(this.styleSheet.cssRules)
        .map((r) => r.cssText)
        .join('\n');
      return allCss;
    } catch (e) {
      console.error('Error exporting CSS:', e);
      return '';
    }
  }

  //==================================================================================
  // Utils
  //==================================================================================

  private generateId(): string {
    return `css_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private validateName(name: string, excludeId?: string): string {
    const match = name.match(/^(.*?)(?:_(\d+))?$/);
    const baseName = match?.[1] ?? name;
    let index = 0;
    let finalName = baseName;
    while (this.cssFileData.some((x) => x.name.toLowerCase() === finalName.toLowerCase() && x.id !== excludeId)) {
      index++;
      finalName = `${baseName}_${index}`;
    }
    return finalName;
  }

  private normalizeSelector(selector: string): string {
    if (!selector.startsWith('.') && !selector.startsWith('#') && !selector.includes('[')) {
      return `.${selector}`;
    }
    return selector;
  }

  private styleObjectToString(styles: Partial<CSSStyleDeclaration>): string {
    const declarations: string[] = [];
    for (const [property, value] of Object.entries(styles)) {
      if (property === 'cssText' || typeof value !== 'string' || value === '') continue;
      const kebab = property.replace(/([A-Z])/g, '-$1').toLowerCase();
      declarations.push(`${kebab}: ${value}`);
    }
    return declarations.join('; ') + (declarations.length > 0 ? ';' : '');
  }

  private updateAvailableClasses(): void {
    const classes = new Set<string>();
    for (const file of this.cssFileData) {
      for (const selector of Object.keys(file.data)) {
        if (!selector.startsWith('.')) continue;
        selector
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.startsWith('.'))
          .map((s) =>
            s
              .substring(1)
              .split(/[\s:>\+~\[]/)[0]
              .trim(),
          )
          .filter((s) => s)
          .forEach((c) => classes.add(c));
      }
    }
    this.availableClassesSubject.next(Array.from(classes).sort());
  }
}
