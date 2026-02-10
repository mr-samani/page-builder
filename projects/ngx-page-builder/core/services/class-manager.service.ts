import { DOCUMENT, inject, Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { PageItem } from '../models/PageItem';
import { HttpClient } from '@angular/common/http';
import { IStyleSheetFile } from '../contracts/IStyleSheetFile';
import { LibConsts } from '../consts/defauls';
import { parseCssBlockToRecord } from '../utiles/css-parser';

export interface ICssFile {
  id: string;
  name: string;
  data: Record<string, string>;
  isImportedPublicCss: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** آیا این فایل به صورت خام (بدون parse) باید اضافه بشه؟ */
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

@Injectable({
  providedIn: 'root',
})
export class ClassManagerService {
  private cssFilesSubject = new BehaviorSubject<ICssFile[]>([]);
  public cssFiles$ = this.cssFilesSubject.asObservable();

  private availableClassesSubject = new BehaviorSubject<string[]>([]);
  public availableClasses$ = this.availableClassesSubject.asObservable();

  public cssFileData: ICssFile[] = [];
  private styleElement: HTMLStyleElement | null = null;
  private styleSheet: CSSStyleSheet | null = null;

  // برای فایل‌های public یک style element جداگانه
  private publicStyleElement: HTMLStyleElement | null = null;

  private rulesMap = new Map<string, { index: number; fileId: string }>();
  private debounceTimers = new Map<string, any>();
  private isInitialized = false;

  doc = inject(DOCUMENT);
  http = inject(HttpClient);
  innerShadowRootDom?: ShadowRoot | null;

  constructor() {
    this.initializeDefaultFile();
    this.importPublicCss();
  }

  private initializeDefaultFile(): void {
    const defaultFile: ICssFile = {
      id: this.generateId(),
      name: 'default',
      data: {
        '*': 'box-sizing:border-box',
        '.img,img': `max-width:100%`,
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

  importPublicCss() {
    for (let css of LibConsts.publicCss) {
      let fileName = css.split('/').pop()?.split('.')?.[0] ?? 'default';
      this.http
        .get(css, {
          responseType: 'text',
          headers: {
            accept: 'text/plain',
          },
        })
        .subscribe({
          next: (content) => {
            if (content && typeof content == 'string') {
              // استفاده از Hybrid approach
              this.addCssFileHybrid(fileName, content, true);
            }
          },
          error: (err) => {
            console.warn('Import css file:', err);
          },
        });
    }
  }

  /**
   * Hybrid Approach: فایل رو raw load می‌کنیم + کلاس‌ها رو extract می‌کنیم
   * این روش بهترین performance و compatibility رو داره
   */
  public async addCssFileHybrid(
    name: string,
    content: string,
    isPublicFile = false,
  ): Promise<ICssFile> {
    name = this.validateName(name);

    // Extract کردن کلاس‌های موجود برای autocomplete
    const extractedClasses = this.extractClassNames(content);

    const newFile: ICssFile = {
      id: this.generateId(),
      name,
      data: extractedClasses, // فقط نام کلاس‌ها (برای لیست)
      createdAt: new Date(),
      updatedAt: new Date(),
      isImportedPublicCss: isPublicFile,
      isRawCss: true,
      rawContent: content,
    };

    this.cssFileData.push(newFile);
    this.updateAvailableClasses();
    this.cssFilesSubject.next(this.cssFileData);

    if (this.isInitialized) {
      this.loadRawCssFile(newFile);
    }

    return newFile;
  }

  /**
   * Extract کردن نام کلاس‌ها از CSS بدون parse کامل
   * این خیلی سریعتر از parse کامل هست
   */
  private extractClassNames(cssContent: string): Record<string, string> {
    const classes: Record<string, string> = {};

    // RegEx برای پیدا کردن class selectors
    // این regex کلاس‌های ساده رو پیدا می‌کنه (مثل .btn, .carousel-item)
    const classRegex = /\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g;

    let match;
    while ((match = classRegex.exec(cssContent)) !== null) {
      const className = match[1];
      // ذخیره کلاس با value خالی (چون فقط برای لیست لازمه)
      if (!classes[`.${className}`]) {
        classes[`.${className}`] = '';
      }
    }

    return classes;
  }

  /**
   * Load کردن فایل CSS خام
   */
  private loadRawCssFile(file: ICssFile): void {
    if (!file.isRawCss || !file.rawContent) return;
    if (!this.publicStyleElement || !this.innerShadowRootDom) return;

    // اضافه کردن محتوای CSS به style element عمومی
    this.publicStyleElement.textContent += `\n/* ${file.name} */\n${file.rawContent}\n`;
  }

  public initialize(): void {
    if (this.isInitialized) return;

    if (!this.innerShadowRootDom) {
      console.warn('PageBuilder shadow root not ready');
      return;
    }

    // ساخت style element برای CSS های عمومی (Bootstrap و غیره)
    let existingPublicStyle = this.innerShadowRootDom.querySelector(
      'style#NgxPageBuilderPublicCSS',
    ) as HTMLStyleElement;

    if (!existingPublicStyle) {
      existingPublicStyle = this.doc.createElement('style');
      existingPublicStyle.id = 'NgxPageBuilderPublicCSS';
      // اضافه کردن به ابتدای shadow root برای اولویت کمتر
      this.innerShadowRootDom.insertBefore(existingPublicStyle, this.innerShadowRootDom.firstChild);
    }

    this.publicStyleElement = existingPublicStyle;

    // ساخت style element برای CSS های custom
    let existingStyle = this.innerShadowRootDom.querySelector(
      'style#NgxPageBuilderClassUI',
    ) as HTMLStyleElement;

    if (!existingStyle) {
      existingStyle = this.doc.createElement('style');
      existingStyle.id = 'NgxPageBuilderClassUI';
      this.innerShadowRootDom.appendChild(existingStyle);
    }

    this.styleElement = existingStyle;
    this.styleSheet = existingStyle.sheet as CSSStyleSheet;

    // Load کردن همه فایل‌ها
    this.loadAllFiles();
    this.isInitialized = true;
  }

  private generateId(): string {
    return `css_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private validateName(name: string, excludeId?: string): string {
    const match = name.match(/^(.*?)(?:_(\d+))?$/);
    const baseName = match?.[1] ?? name;

    let index = 0;
    let finalName = baseName;

    while (
      this.cssFileData.some(
        (x) => x.name.toLowerCase() === finalName.toLowerCase() && x.id !== excludeId,
      )
    ) {
      index++;
      finalName = `${baseName}_${index}`;
    }

    return finalName;
  }

  public async addBlockCss(item: PageItem): Promise<void> {
    if (!item || !item.css) return;

    try {
      const parsedCss = await parseCssBlockToRecord(item.css);
      if (Object.keys(parsedCss).length === 0) return;

      const defaultFileId = this.cssFileData[0]?.id;
      if (!defaultFileId) {
        console.error('No CSS file available');
        return;
      }

      for (const [selector, cssText] of Object.entries(parsedCss)) {
        const normalizedSelector = this.normalizeSelector(selector);
        const existingCssText = this.getClassStyles(normalizedSelector);

        if (existingCssText) {
          if ((await this.isEqualCss(existingCssText, cssText)) == true) {
            continue;
          } else {
            const newSelector = this.generateUniqueSelector(normalizedSelector);
            this.updateClass(newSelector, cssText, defaultFileId);
            this.updateItemClassList(item, normalizedSelector, newSelector);

            const replaceAll = (item: PageItem, previousName: string, newName: string) => {
              let i = item.classList.findIndex((x: string) => '.' + x == previousName);
              if (i > -1) {
                item.classList[i] = newName;
              }
              if (item.children) for (let c of item.children) replaceAll(c, previousName, newName);
              if (item.template) replaceAll(item.template, previousName, newName);
            };
            replaceAll(item, selector, newSelector);
          }
        } else {
          this.updateClass(normalizedSelector, cssText, defaultFileId);
        }
      }
    } catch (error) {
      console.error('Error adding block CSS:', error);
    }
  }

  private isEqualCss(a: string, b: string): boolean {
    return true;
  }

  getBlockStyles(item: PageItem) {
    let css = '';
    const tree = (item: PageItem) => {
      for (let c of item.classList) {
        const s = this.getClassStyles(c);
        if (s) {
          css += `
.${c}{
  ${s}
}
`;
        }
      }
      if (item.children) {
        for (let child of item.children) {
          tree(child);
        }
      }
    };
    tree(item);
    return css;
  }

  private normalizeCssText(cssText: string): string {
    return cssText
      .replace(/\s+/g, ' ')
      .replace(/;\s*$/, '')
      .replace(/\s*:\s*/g, ':')
      .replace(/\s*;\s*/g, ';')
      .toLowerCase()
      .trim();
  }

  private generateUniqueSelector(baseSelector: string): string {
    if (!baseSelector.startsWith('.') && !baseSelector.startsWith('#')) {
      return baseSelector;
    }

    const prefix = baseSelector.charAt(0);
    const baseName = baseSelector.substring(1);
    const match = baseName.match(/^(.*?)(-(\d+))?$/);
    const cleanName = match?.[1] ?? baseName;

    let counter = 1;
    let newSelector = baseSelector;

    while (this.hasClass(newSelector)) {
      newSelector = `${prefix}${cleanName}-${counter}`;
      counter++;
    }

    return newSelector;
  }

  private updateItemClassList(item: PageItem, oldSelector: string, newSelector: string): void {
    if (!item.classList || !Array.isArray(item.classList)) return;

    const oldClassName =
      oldSelector.startsWith('.') || oldSelector.startsWith('#')
        ? oldSelector.substring(1)
        : oldSelector;

    const newClassName =
      newSelector.startsWith('.') || newSelector.startsWith('#')
        ? newSelector.substring(1)
        : newSelector;

    const index = item.classList.indexOf(oldClassName);

    if (index !== -1) {
      item.classList[index] = newClassName;
    }
    if (item.children) {
      for (let child of item.children) {
        this.updateItemClassList(child, oldSelector, newSelector);
      }
    }
    if (item.template) {
      this.updateItemClassList(item.template, oldSelector, newSelector);
    }
  }

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

    if (this.isInitialized) {
      this.loadFileRules(newFile);
    }

    return newFile;
  }

  public async addToDefaultStyles(content: string): Promise<void> {
    const defulatFile = this.cssFileData.find((f) => f.name === 'default');
    if (defulatFile) {
      await this.updateCssFile(defulatFile.id, content, false);
    } else {
      await this.addCssFile('default', content);
    }
  }

  public async updateCssFile(
    fileId: string,
    content: string | Record<string, string>,
    replace = true,
  ): Promise<void> {
    const fileIndex = this.cssFileData.findIndex((f) => f.id === fileId);
    if (fileIndex === -1) {
      throw new Error(`File with id ${fileId} not found`);
    }
    const file = this.cssFileData[fileIndex];

    // اگر فایل raw است
    if (file.isRawCss) {
      if (typeof content != 'string') {
        throw new Error('File css Content must be string');
      }
      file.rawContent = content;
      // دوباره extract کردن کلاس‌ها
      file.data = this.extractClassNames(content);
      file.updatedAt = new Date();
      this.updateAvailableClasses();
      this.cssFilesSubject.next(this.cssFileData);

      if (this.isInitialized && this.publicStyleElement) {
        this.reloadAllRawFiles();
      }
      return;
    }

    const data = typeof content == 'string' ? await parseCssBlockToRecord(content) : content;

    if (replace) {
      this.removeFileRules(fileId);
      file.data = data;
    } else {
      file.data = Object.assign(file.data, data);
    }
    file.updatedAt = new Date();

    this.updateAvailableClasses();
    this.cssFilesSubject.next(this.cssFileData);

    if (this.isInitialized) {
      this.loadFileRules(file);
    }
  }

  private reloadAllRawFiles(): void {
    if (!this.publicStyleElement) return;

    this.publicStyleElement.textContent = '';

    this.cssFileData.forEach((file) => {
      if (file.isRawCss && file.rawContent) {
        this.loadRawCssFile(file);
      }
    });
  }

  public removeCssFile(fileId: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      try {
        const fileIndex = this.cssFileData.findIndex((f) => f.id === fileId);
        if (fileIndex === -1) {
          throw new Error('File not found');
        }

        const file = this.cssFileData[fileIndex];
        this.cssFileData.splice(fileIndex, 1);

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

  private loadAllFiles(): void {
    if (!this.styleSheet) return;

    this.clearAllRules();

    this.cssFileData.forEach((file) => {
      if (file.isRawCss) {
        this.loadRawCssFile(file);
      } else {
        this.loadFileRules(file);
      }
    });
  }

  private loadFileRules(file: ICssFile): void {
    if (!this.styleSheet || file.isRawCss) return;

    Object.entries(file.data).forEach(([selector, cssText]) => {
      this.insertRule(selector, cssText, file.id);
    });
  }

  private removeFileRules(fileId: string): void {
    if (!this.styleSheet) return;

    const rulesToRemove: string[] = [];
    this.rulesMap.forEach((value, selector) => {
      if (value.fileId === fileId) {
        rulesToRemove.push(selector);
      }
    });

    rulesToRemove
      .sort((a, b) => {
        const indexA = this.rulesMap.get(a)?.index ?? 0;
        const indexB = this.rulesMap.get(b)?.index ?? 0;
        return indexB - indexA;
      })
      .forEach((selector) => {
        this.deleteRule(selector);
      });
  }

  private insertRule(selector: string, cssText: string, fileId: string): void {
    if (!this.styleSheet) return;

    try {
      const ruleText = `${selector} { ${cssText} }`;
      const index = this.styleSheet.cssRules.length;

      this.styleSheet.insertRule(ruleText, index);
      this.rulesMap.set(selector, { index, fileId });
    } catch (e) {
      console.debug(`Could not insert rule ${selector}:`, e);
    }
  }

  private deleteRule(selector: string): void {
    if (!this.styleSheet) return;

    const ruleInfo = this.rulesMap.get(selector);
    if (!ruleInfo) return;

    try {
      this.styleSheet.deleteRule(ruleInfo.index);
      this.rulesMap.delete(selector);

      this.rulesMap.forEach((value, key) => {
        if (value.index > ruleInfo.index) {
          value.index--;
        }
      });
    } catch (e) {
      console.error(`Error deleting rule ${selector}:`, e);
    }
  }

  public updateClass(
    selector: string,
    styles: Partial<CSSStyleDeclaration> | string,
    fileId?: string,
  ): void {
    if (!this.styleSheet) {
      console.warn('StyleSheet not initialized. Call initialize() first.');
      return;
    }

    const cssText = typeof styles === 'string' ? styles : this.styleObjectToString(styles);
    const normalizedSelector = this.normalizeSelector(selector);
    const targetFileId =
      fileId || this.rulesMap.get(normalizedSelector)?.fileId || this.cssFileData[0]?.id;

    if (!targetFileId) {
      console.error('No file available to add class');
      return;
    }

    const ruleText = `${normalizedSelector} { ${cssText} }`;

    try {
      const existingRule = this.rulesMap.get(normalizedSelector);

      if (existingRule) {
        this.styleSheet.deleteRule(existingRule.index);
        this.styleSheet.insertRule(ruleText, existingRule.index);
      } else {
        const index = this.styleSheet.cssRules.length;
        this.styleSheet.insertRule(ruleText, index);
        this.rulesMap.set(normalizedSelector, { index, fileId: targetFileId });
      }

      const file = this.cssFileData.find((f) => f.id === targetFileId);
      if (file && !file.isRawCss) {
        file.data[normalizedSelector] = cssText;
        file.updatedAt = new Date();
        this.updateAvailableClasses();
        this.cssFilesSubject.next(this.cssFileData);
      }
    } catch (e) {
      console.error('Error updating CSS rule:', e);
    }
  }

  public updateClassDebounced(
    selector: string,
    styles: Partial<CSSStyleDeclaration> | string,
    delay: number = 16,
    fileId?: string,
  ): void {
    const normalizedSelector = this.normalizeSelector(selector);

    const existingTimer = this.debounceTimers.get(normalizedSelector);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.updateClass(normalizedSelector, styles, fileId);
      this.debounceTimers.delete(normalizedSelector);
    }, delay);

    this.debounceTimers.set(normalizedSelector, timer);
  }

  public updateClassImmediate(
    selector: string,
    styles: Partial<CSSStyleDeclaration> | string,
    fileId?: string,
  ): void {
    requestAnimationFrame(() => {
      this.updateClass(selector, styles, fileId);
    });
  }

  public updateClasses(
    classes: Record<string, Partial<CSSStyleDeclaration> | string>,
    fileId?: string,
  ): void {
    requestAnimationFrame(() => {
      Object.entries(classes).forEach(([selector, styles]) => {
        this.updateClass(selector, styles, fileId);
      });
    });
  }

  public removeClass(selector: string): void {
    const normalizedSelector = this.normalizeSelector(selector);
    const ruleInfo = this.rulesMap.get(normalizedSelector);

    if (!ruleInfo) return;

    this.deleteRule(normalizedSelector);

    const file = this.cssFileData.find((f) => f.id === ruleInfo.fileId);
    if (file && !file.isRawCss) {
      delete file.data[normalizedSelector];
      file.updatedAt = new Date();
      this.updateAvailableClasses();
      this.cssFilesSubject.next(this.cssFileData);
    }
  }

  public renameClass(oldSelector: string, newSelector: string): void {
    const normalizedOldSelector = this.normalizeSelector(oldSelector);
    const normalizedNewSelector = this.normalizeSelector(newSelector);

    if (normalizedOldSelector === normalizedNewSelector) return;

    const ruleInfo = this.rulesMap.get(normalizedOldSelector);
    if (!ruleInfo) return;

    const cssText = this.getClassStyles(normalizedOldSelector);
    if (!cssText) return;

    this.deleteRule(normalizedOldSelector);
    this.insertRule(normalizedNewSelector, cssText, ruleInfo.fileId);

    const file = this.cssFileData.find((f) => f.id === ruleInfo.fileId);
    if (file && !file.isRawCss) {
      delete file.data[normalizedOldSelector];
      file.data[normalizedNewSelector] = cssText;
      file.updatedAt = new Date();
      this.updateAvailableClasses();
      this.cssFilesSubject.next(this.cssFileData);
    }
  }

  public getClassStyles(selector: string): string | null {
    if (!this.styleSheet) return null;

    const normalizedSelector = this.normalizeSelector(selector);
    const ruleInfo = this.rulesMap.get(normalizedSelector);

    if (!ruleInfo) return null;

    try {
      const rule = this.styleSheet.cssRules[ruleInfo.index] as CSSStyleRule;
      return rule.style.cssText;
    } catch (e) {
      console.error('Error getting CSS rule:', e);
      return null;
    }
  }

  public getClassInfo(selector: string): IClassInfo | null {
    const normalizedSelector = this.normalizeSelector(selector);
    const ruleInfo = this.rulesMap.get(normalizedSelector);

    if (!ruleInfo) return null;

    const cssText = this.getClassStyles(normalizedSelector);
    if (!cssText) return null;

    const file = this.cssFileData.find((f) => f.id === ruleInfo.fileId);

    return {
      selector: normalizedSelector,
      cssText,
      fileName: file?.name || 'unknown',
      fileId: ruleInfo.fileId,
    };
  }

  public hasClass(selector: string): boolean {
    const normalizedSelector = this.normalizeSelector(selector);
    return this.rulesMap.has(normalizedSelector);
  }

  private clearAllRules(): void {
    if (!this.styleSheet) return;

    try {
      while (this.styleSheet.cssRules.length > 0) {
        this.styleSheet.deleteRule(0);
      }
      this.rulesMap.clear();
    } catch (e) {
      console.error('Error clearing stylesheet:', e);
    }
  }

  public exportFileCSS(fileId: string): string {
    const file = this.cssFileData.find((f) => f.id === fileId);
    if (!file) return '';

    if (file.isRawCss && file.rawContent) {
      return file.rawContent;
    }

    const rules: string[] = [];
    Object.entries(file.data).forEach(([selector, cssText]) => {
      rules.push(`${selector} { ${cssText} }`);
    });

    return rules.join('\n\n');
  }

  public exportAllFileCSS(): IStyleSheetFile[] {
    const files: IStyleSheetFile[] = [];
    for (let file of this.cssFileData) {
      if (file.isImportedPublicCss) {
        continue;
      }

      let data: string;
      if (file.isRawCss && file.rawContent) {
        data = file.rawContent;
      } else {
        const rules: string[] = [];
        Object.entries(file.data).forEach(([selector, cssText]) => {
          rules.push(`${selector} { ${cssText} }`);
        });
        data = rules.join('\n\n');
      }

      files.push({
        name: file.name,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        data,
      });
    }

    return files;
  }

  public exportAllCSS(): string {
    if (!this.styleSheet) return '';

    try {
      let allCss = '';

      if (this.publicStyleElement && this.publicStyleElement.textContent) {
        allCss += this.publicStyleElement.textContent + '\n\n';
      }

      const rules = Array.from(this.styleSheet.cssRules);
      allCss += rules.map((rule) => rule.cssText).join('\n');

      return allCss;
    } catch (e) {
      console.error('Error exporting CSS:', e);
      return '';
    }
  }

  private updateAvailableClasses(): void {
    const classes = new Set<string>();

    this.cssFileData.forEach((file) => {
      Object.keys(file.data).forEach((selector) => {
        if (selector.startsWith('.')) {
          const classNames = selector
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.startsWith('.'))
            .map((s) =>
              s
                .substring(1)
                .split(/[\s:>\+~\[]/)[0]
                .trim(),
            )
            .filter((s) => s);

          classNames.forEach((c) => classes.add(c));
        }
      });
    });

    const availableClasses = Array.from(classes).sort();
    this.availableClassesSubject.next(availableClasses);
  }

  private normalizeSelector(selector: string): string {
    if (!selector.startsWith('.') && !selector.startsWith('#') && !selector.includes('[')) {
      return `.${selector}`;
    }
    return selector;
  }

  private styleObjectToString(styles: Partial<CSSStyleDeclaration>): string {
    const declarations: string[] = [];

    Object.entries(styles).forEach(([property, value]) => {
      if (property === 'cssText' || typeof value !== 'string' || value == '') {
        return;
      }

      const kebabProperty = property.replace(/([A-Z])/g, '-$1').toLowerCase();
      declarations.push(`${kebabProperty}: ${value}`);
    });

    return declarations.join('; ') + (declarations.length > 0 ? ';' : '');
  }

  public get rulesCount(): number {
    return this.rulesMap.size;
  }

  public destroy(): void {
    this.debounceTimers.forEach((timer) => clearTimeout(timer));
    this.debounceTimers.clear();

    if (this.styleElement && this.styleElement.parentNode) {
      this.styleElement.parentNode.removeChild(this.styleElement);
    }

    if (this.publicStyleElement && this.publicStyleElement.parentNode) {
      this.publicStyleElement.parentNode.removeChild(this.publicStyleElement);
    }

    this.styleElement = null;
    this.publicStyleElement = null;
    this.styleSheet = null;
    this.rulesMap.clear();
    this.cssFileData = [];
    this.isInitialized = false;

    this.cssFilesSubject.next([]);
    this.availableClassesSubject.next([]);
  }
}
