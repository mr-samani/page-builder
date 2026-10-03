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
  BlockCssContext,
  BreakpointSetup,
  DEFAULT_BREAKPOINT_SETUP,
  PseudoState,
  compileBlocksCss,
  getChunkText,
  isBlockCssEmpty,
  isBlockClass,
  isSafeDecl,
  listContexts,
  mediaCondition,
  mediaRank,
  normalizeBlockCss,
  parseDecls,
  pseudoRank,
  resolveDecls,
  setChunkText,
  stringifyDecls,
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

/** رفرنس مستقیم به rule های یک (breakpoint) — بدون هیچ ایندکس عددی */
interface CtxRefs {
  base?: CSSStyleRule;
  states: Map<PseudoState, CSSStyleRule>;
}

/** رفرنس‌های rule های مربوط به یک node: breakpoint پایه (root) + بقیه‌ی breakpointها */
interface NodeStyleRefs {
  root: CtxRefs;
  bps: Map<BreakPointKey, CtxRefs>;
}

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
  private mediaRules: { key: BreakPointKey; rank: number; rule: GroupingRule }[] = [];

  private rootVarsRule?: CSSStyleRule;

  /** breakpointهای فعال + کلید breakpoint پایه (بدون media query) */
  private setup: BreakpointSetup = DEFAULT_BREAKPOINT_SETUP;
  public get breakpointSetup(): BreakpointSetup {
    return this.setup;
  }

  doc = inject(DOCUMENT);
  http = inject(HttpClient);

  private _cssVariables: ICssVariable[] = [];
  private cssVariablesSubject = new BehaviorSubject<ICssVariable[]>([]);
  /** برای انتخابگرهای متغیر CSS در پنل — با هر تغییر متغیرها مقدار جدید می‌دهد */
  public cssVariables$ = this.cssVariablesSubject.asObservable();

  public get cssVariables(): ICssVariable[] {
    return this._cssVariables;
  }

  public setCssVariables(val: ICssVariable[]): void {
    this._cssVariables = val ?? [];
    this.cssVariablesSubject.next(this._cssVariables);
    val = this._cssVariables;
    if (!this.rootVarsRule) return;
    let cssText = '';
    for (const c of val) {
      if (!c?.name || !isSafeDecl(`--${c.name}`, String(c.value ?? ''))) continue;
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
   * ویرایش «کلاس مشترک» (لایه files). برای استایل خودِ بلاک، سراغ setBlockStyle بروید
   * (آن item.css را به‌روز می‌کند و بر اساس breakpoint/state فعال می‌نویسد).
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
  //
  // منبع حقیقت (source of truth) همیشه `item.css` است (متن declaration ها؛ همان چیزی که ذخیره می‌شود).
  // CSSOM (rule های داخل styleSheet) فقط یک «نمایش» از item.css است و با syncContext هماهنگ می‌شود.
  //
  // ترتیب داخل @layer blocks (مهم برای درست بودن cascade):
  //   [ rule های base/state همه‌ی بلاک‌ها ]  →  [ @media ها به ترتیب mediaRank ]
  // و برای هر بلاک: base → visited → hover → focus → focus-visible → active → checked → disabled
  //==================================================================================

  /** کلاس اختصاصی بلاک (blk-<id>) را تضمین می‌کند و روی المان هم اضافه می‌کند (کلاس به tag وابسته نیست) */
  private ensureBlockClassName(item: PageItem): string {
    let cls = item.classList?.find((c) => isBlockClass(c));
    if (!cls) {
      cls = `blk-${item.id}`;
      item.classList ??= [];
      item.classList.push(cls);
    }
    // اولین بار که استایل ساخته می‌شود، المان از قبل ساخته شده و کلاس ندارد
    if (item.el && !item.el.classList.contains(cls)) item.el.classList.add(cls);
    return cls;
  }

  private getRefs(id: string): NodeStyleRefs {
    let refs = this.nodeRefs.get(id);
    if (!refs) {
      refs = { root: { states: new Map() }, bps: new Map() };
      this.nodeRefs.set(id, refs);
    }
    return refs;
  }

  private getOrCreateMediaRule(bpKey: BreakPointKey): GroupingRule | undefined {
    if (!this.blocksLayer) return undefined;
    const existing = this.mediaRules.find((m) => m.key === bpKey);
    if (existing) return existing.rule;

    const cond = mediaCondition(this.setup, bpKey);
    if (!cond) {
      console.warn(`Unknown or base breakpoint: ${bpKey}`);
      return undefined;
    }

    const rank = mediaRank(this.setup, bpKey);
    let listIdx = this.mediaRules.findIndex((m) => m.rank > rank);
    let insertAt = this.blocksLayer.cssRules.length;
    if (listIdx === -1) {
      listIdx = this.mediaRules.length;
    } else {
      const idx = Array.prototype.indexOf.call(this.blocksLayer.cssRules, this.mediaRules[listIdx].rule);
      if (idx > -1) insertAt = idx;
    }

    const idx = this.blocksLayer.insertRule(`@media ${cond}{}`, insertAt);
    const rule = this.blocksLayer.cssRules[idx] as unknown as GroupingRule;
    this.mediaRules.splice(listIdx, 0, { key: bpKey, rank, rule });
    return rule;
  }

  /**
   * ایندکس درج یک rule جدید:
   *  - اگر برای همین بلاک rule ای با اولویت بالاتر (state دیرتر) از قبل هست → درست قبل از آن
   *  - وگرنه: انتهای ناحیه‌ی base/state (در ریشه، قبل از media ها) یا انتهای media
   * حالت دوم O(1) است، پس بارگذاری هزاران بلاک کند نمی‌شود.
   */
  private insertIndex(container: GroupingRule, isRoot: boolean, refs: CtxRefs, state: PseudoState): number {
    const myRank = pseudoRank(state);
    let next: CSSRule | undefined;
    let nextRank = Infinity;
    for (const [s, r] of refs.states) {
      const rk = pseudoRank(s);
      if (rk > myRank && rk < nextRank) {
        next = r;
        nextRank = rk;
      }
    }
    if (next) {
      const i = Array.prototype.indexOf.call(container.cssRules, next);
      if (i > -1) return i;
    }
    // در ریشه، media ها همیشه انتهای لایه‌اند
    return isRoot ? container.cssRules.length - this.mediaRules.length : container.cssRules.length;
  }

  /** rule مربوط به یک context را با متن فعلی item.css هماهنگ می‌کند (ساخت / به‌روزرسانی / حذف) */
  private syncContext(item: PageItem, ctx: BlockCssContext): void {
    if (!this.blocksLayer) return;
    const text = getChunkText(normalizeBlockCss(item.css), this.setup, ctx);
    const isRoot = ctx.bp === this.setup.baseKey;

    const nodeRefs = this.getRefs(item.id);
    let ctxRefs: CtxRefs | undefined = isRoot ? nodeRefs.root : nodeRefs.bps.get(ctx.bp);
    if (!ctxRefs) {
      if (!text) return; // چیزی برای حذف نیست
      ctxRefs = { states: new Map() };
      if (!isRoot) nodeRefs.bps.set(ctx.bp, ctxRefs);
    }

    const container = isRoot ? this.blocksLayer : this.getOrCreateMediaRule(ctx.bp);
    if (!container) return;

    const existing = ctx.state === 'none' ? ctxRefs.base : ctxRefs.states.get(ctx.state);

    if (!text) {
      if (existing) this.deleteRuleRef(container, existing);
      if (ctx.state === 'none') ctxRefs.base = undefined;
      else ctxRefs.states.delete(ctx.state);
      if (!isRoot && !ctxRefs.base && !ctxRefs.states.size) nodeRefs.bps.delete(ctx.bp);
      return;
    }

    if (existing) {
      // مسیر داغ (هر تغییر کاربر): فقط یک انتساب روی CSSOM
      existing.style.cssText = text;
      return;
    }

    const selector = '.' + this.ensureBlockClassName(item) + (ctx.state === 'none' ? '' : ':' + ctx.state);
    try {
      const at = this.insertIndex(container, isRoot, ctxRefs, ctx.state);
      container.insertRule(`${selector}{${text}}`, at);
      const rule = container.cssRules[at] as CSSStyleRule;
      if (ctx.state === 'none') ctxRefs.base = rule;
      else ctxRefs.states.set(ctx.state, rule);
    } catch (e) {
      console.warn(`Could not insert block rule for ${selector}:`, e);
    }
  }

  /** همه‌ی contextهای item (چه در css و چه rule های موجود) را هماهنگ می‌کند؛ rule های اضافی حذف می‌شوند */
  private syncAllContexts(item: PageItem): void {
    const css = normalizeBlockCss(item.css);
    const seen = new Set<string>();
    const run = (ctx: BlockCssContext) => {
      const k = `${ctx.bp}|${ctx.state}`;
      if (seen.has(k)) return;
      seen.add(k);
      this.syncContext(item, ctx);
    };
    for (const ctx of listContexts(css, this.setup)) run(ctx);

    const refs = this.nodeRefs.get(item.id);
    if (!refs) return;
    const stale = (bp: BreakPointKey, c: CtxRefs) => {
      if (c.base) run({ bp, state: 'none' });
      for (const s of Array.from(c.states.keys())) run({ bp, state: s });
    };
    stale(this.setup.baseKey, refs.root);
    for (const [bp, c] of Array.from(refs.bps)) stale(bp, c);
  }

  /**
   * اعمال استایل یک بلاک از روی item.css (هنگام ساخت المان / بارگذاری صفحه / undo و redo).
   * برای ساخت درخت، createBlockElement خودش برای هر بلاک صدا می‌زند، پس آنجا recursive=false بدهید.
   */
  public addBlockCss(item: PageItem, recursive = true): void {
    if (!item) return;
    if (!this.blocksLayer) {
      console.warn('ClassManagerService not initialized yet');
      return;
    }
    if (typeof item.css === 'string') item.css = normalizeBlockCss(item.css); // سازگاری با داده‌ی قدیمی
    if (item.css || this.nodeRefs.has(item.id)) this.syncAllContexts(item);

    if (!recursive) return;
    if (item.children) for (const child of item.children) this.addBlockCss(child, true);
    if (item.template) this.addBlockCss(item.template, true);
  }

  //---------------------------------- API پنل تنظیمات ----------------------------------

  private toCtx(ctx?: Partial<BlockCssContext>): BlockCssContext {
    return { bp: ctx?.bp ?? this.setup.baseKey, state: ctx?.state ?? 'none' };
  }

  /** فقط مقادیری که خود کاربر در همین context ثبت کرده (بدون ارث‌بری) — kebab-case */
  public getOwnDeclarations(item: PageItem, ctx?: Partial<BlockCssContext>): Record<string, string> {
    const text = getChunkText(normalizeBlockCss(item.css), this.setup, this.toCtx(ctx));
    return Object.fromEntries(parseDecls(text));
  }

  /** مقدار مؤثر با ارث‌بری از base و breakpointهای میانی — برای پر کردن کنترل‌ها — kebab-case */
  public getEffectiveDeclarations(item: PageItem, ctx?: Partial<BlockCssContext>): Record<string, string> {
    return Object.fromEntries(resolveDecls(normalizeBlockCss(item.css), this.setup, this.toCtx(ctx)));
  }

  public hasOwnDeclarations(item: PageItem, ctx?: Partial<BlockCssContext>): boolean {
    return !!getChunkText(normalizeBlockCss(item.css), this.setup, this.toCtx(ctx));
  }

  /**
   * تغییر استایل بلاک در یک context. `patch`: کلید kebab-case → مقدار؛ null/'' یعنی حذف override.
   * item.css را به‌روز می‌کند و همان لحظه روی CSSOM اعمال می‌کند (یک انتساب، بدون بازسازی).
   * @returns true اگر واقعاً چیزی تغییر کرد
   */
  public setBlockStyle(
    item: PageItem,
    ctx: Partial<BlockCssContext> | undefined,
    patch: Record<string, string | null | undefined>,
  ): boolean {
    if (!item) return false;
    const c = this.toCtx(ctx);
    const css: BlockCss = normalizeBlockCss(item.css) ?? {};

    const map = parseDecls(getChunkText(css, this.setup, c));
    let changed = false;
    for (const [rawKey, rawVal] of Object.entries(patch)) {
      const key = rawKey.startsWith('--') ? rawKey : rawKey.toLowerCase();
      const val = rawVal == null ? '' : String(rawVal).trim();
      if (!val) {
        changed = map.delete(key) || changed;
        continue;
      }
      if (!isSafeDecl(key, val)) {
        console.warn(`Rejected unsafe declaration: ${key}`);
        continue;
      }
      if (map.get(key) !== val) {
        map.set(key, val);
        changed = true;
      }
    }
    if (!changed) return false;

    setChunkText(css, this.setup, c, stringifyDecls(map));
    item.css = isBlockCssEmpty(css) ? undefined : css;
    this.syncContext(item, c);
    return true;
  }

  /** حذف همه‌ی override های یک context (مثلاً «reset hover در tablet») */
  public resetBlockContext(item: PageItem, ctx?: Partial<BlockCssContext>): boolean {
    const own = this.getOwnDeclarations(item, ctx);
    const patch: Record<string, null> = {};
    for (const k of Object.keys(own)) patch[k] = null;
    return this.setBlockStyle(item, ctx, patch);
  }

  /** css خام بلاک (برای دیباگ/سازگاری با کد قدیمی) */
  public getBlockCss(item: PageItem): BlockCss | undefined {
    return normalizeBlockCss(item.css);
  }

  /** حذف کامل استایل یک بلاک هنگام حذف بلاک از صفحه — از removeBlock در PageBuilderService صدا زده می‌شود */
  public removeBlockCss(item: PageItem): void {
    const refs = this.nodeRefs.get(item.id);
    if (refs && this.blocksLayer) {
      if (refs.root.base) this.deleteRuleRef(this.blocksLayer, refs.root.base);
      for (const r of refs.root.states.values()) this.deleteRuleRef(this.blocksLayer, r);
      for (const [bpKey, c] of refs.bps) {
        const media = this.mediaRules.find((m) => m.key === bpKey)?.rule;
        if (!media) continue;
        if (c.base) this.deleteRuleRef(media, c.base);
        for (const r of c.states.values()) this.deleteRuleRef(media, r);
      }
    }
    this.nodeRefs.delete(item.id);

    if (item.children) for (const c of item.children) this.removeBlockCss(c);
    if (item.template) this.removeBlockCss(item.template);
  }

  /**
   * تنظیم breakpointها (مثلاً از تنظیمات پروژه). چون شرط media ها عوض می‌شود،
   * لایه‌ی blocks خالی می‌شود و استایل `roots` دوباره ساخته می‌شود.
   */
  public setBreakpoints(setup: BreakpointSetup, roots: PageItem[] = []): void {
    this.setup = setup;
    if (!this.blocksLayer) return;
    while (this.blocksLayer.cssRules.length) this.blocksLayer.deleteRule(this.blocksLayer.cssRules.length - 1);
    this.mediaRules = [];
    this.nodeRefs.clear();
    for (const r of roots) this.addBlockCss(r, true);
  }

  /** استایل کامل درخت (base + state ها + media ها) برای اسنپ‌شات/پلاگین، به‌همراه کلاس‌های دستی بلاک */
  getBlockStyles(item: PageItem): string {
    let css = compileBlocksCss([item], this.setup);
    const tree = (node: PageItem) => {
      for (const c of node.classList) {
        if (isBlockClass(c)) continue;
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
