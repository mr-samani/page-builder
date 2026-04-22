import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  DOCUMENT,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { DynamicAutocompleteDirective } from '../../directives/ngx-dynamic-data-autocomplete.directive';
import { fromEvent, Subscription } from 'rxjs';
import { DynamicDataService, PageItem } from 'ngx-page-builder/core';
import { DIALOG_DATA, NgxDialogRef } from '../../extensions/dialog';

@Component({
  selector: 'app-text-editor',
  templateUrl: './text-editor.component.html',
  styleUrls: ['./text-editor.component.scss'],
  imports: [FormsModule, DynamicAutocompleteDirective],
})
export class TextEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('editable', { static: true }) editableRef!: ElementRef<HTMLElement>;

  @Input() set value(v: string | null) {
    this._value = v || '';
    if (this.editableRef) this.editableRef.nativeElement.innerHTML = this._value;
  }
  get value() {
    return this._value;
  }
  private _value = '';

  @Output() touched = new EventEmitter<void>();

  fontFamilies = ['Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New', 'Verdana', 'Tahoma', 'System UI'];
  fontSizes = [10, 12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 36];

  fontFamily = 'Arial';
  fontSize = 14;
  textColor = '#000000';
  bgColor = '#ffffff';

  // ✅ ذخیره selection
  private savedSelection: Range | null = null;

  // ✅ نمایش تعداد کاراکترهای انتخاب شده
  selectedCharCount = 0;

  subscriptions: Subscription[] = [];
  data = inject<PageItem>(DIALOG_DATA);
  private doc = inject(DOCUMENT);
  constructor(
    private sanitizer: DomSanitizer,
    private dialogRef: NgxDialogRef,
    private chdRef: ChangeDetectorRef,
    public dynamicDataService: DynamicDataService,
  ) {
    this._value = this.data.content || '';
  }

  ngAfterViewInit() {
    this.editableRef.nativeElement.innerHTML = this._value || '';

    this.subscriptions = [
      fromEvent(this.editableRef.nativeElement, 'selectstart').subscribe(() => this.saveSelection('selectstart')),
      fromEvent(this.editableRef.nativeElement, 'selectend').subscribe(() => this.saveSelection('selectend')),
      // ✅ Listen به تغییرات selection
      fromEvent(this.doc, 'mouseup').subscribe(() => this.saveSelection('mouseup')),
      fromEvent(this.doc, 'keyup').subscribe(() => this.saveSelection('keyup')),
    ];
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  // ✅ ذخیره کردن selection فعلی
  saveSelection(eventType: string = 'other') {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      this.savedSelection = sel.getRangeAt(0).cloneRange();

      // محاسبه تعداد کاراکترهای انتخاب شده
      const selectedText = sel.toString();
      this.selectedCharCount = selectedText.length;
      // آپدیت toolbar state
      this.updateToolbarState();
    }
    console.log('Selection saved on:', eventType);
    this.chdRef.detectChanges();
  }

  // ✅ بازگردانی selection ذخیره شده
  restoreSelection() {
    if (this.savedSelection) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(this.savedSelection);
      }
    }
  }

  execCommand(cmd: string, value: string | null = null) {
    try {
      this.doc.execCommand(cmd, false, value as any);
    } catch (e) {
      console.warn('execCommand failed for', cmd, e);
    }
  }

  isCommandActive(cmd: string) {
    try {
      return this.doc.queryCommandState(cmd);
    } catch {
      return false;
    }
  }

  setAlign(direction: 'left' | 'center' | 'right') {
    this.restoreSelection(); // ✅ بازگردانی selection

    const cmd = direction === 'left' ? 'justifyleft' : direction === 'center' ? 'justifycenter' : 'justifyright';
    this.execCommand(cmd);

    this.saveSelection(); // ✅ ذخیره selection جدید
  }

  setFontFamily(family: string) {
    this.fontFamily = family;
    this.restoreSelection(); // ✅ بازگردانی selection
    this.applyStyle({ fontFamily: family });
  }

  setFontSize(size: string) {
    const px = parseInt(size, 10) || 14;
    this.fontSize = px;
    this.restoreSelection(); // ✅ بازگردانی selection
    this.applyStyle({ fontSize: px + 'px' });
  }

  // ✅ برای color picker ها که با (change) یا (input) کار میکنن
  onTextColorChange(color: string) {
    this.textColor = color;
    this.restoreSelection(); // ✅ بازگردانی selection قبل از apply
    this.applyStyle({ color: color });
  }

  onBgColorChange(color: string) {
    this.bgColor = color;
    this.restoreSelection(); // ✅ بازگردانی selection قبل از apply
    this.applyStyle({ backgroundColor: color });
  }

  applyStyle(styleObj: { [k: string]: string }) {
    const range = this.savedSelection;
    const sel = this.doc.getSelection();

    // اگر هیچ متنی انتخاب نشده
    if (!range || range.collapsed || !sel) {
      console.warn('No text selected. Please select text to apply styles.');
      return;
    }

    const span = this.doc.createElement('span');
    this.applyStyleObject(span.style, styleObj);

    try {
      range.surroundContents(span);
    } catch (e) {
      const fragment = range.extractContents();
      this.applyStyleToFragment(fragment, styleObj);
      span.appendChild(fragment);
      range.insertNode(span);
    }

    // ✅ selection را حفظ کن
    sel.removeAllRanges();
    const newRange = this.doc.createRange();
    newRange.selectNodeContents(span);
    sel.addRange(newRange);

    // ✅ selection جدید را ذخیره کن
    this.savedSelection = newRange.cloneRange();

    this.editableRef.nativeElement.normalize();
  }

  applyStyleToFragment(fragment: DocumentFragment, styleObj: { [k: string]: string }) {
    const walker = this.doc.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);

    const nodesToWrap: Node[] = [];
    let node: Node | null;

    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
        nodesToWrap.push(node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.tagName === 'SPAN') {
          this.applyStyleObject(el.style, styleObj);
        }
      }
    }

    nodesToWrap.forEach((textNode) => {
      const span = this.doc.createElement('span');
      this.applyStyleObject(span.style, styleObj);

      const parent = textNode.parentNode;
      if (parent) {
        parent.insertBefore(span, textNode);
        span.appendChild(textNode);
      }
    });
  }

  applyStyleObject(style: CSSStyleDeclaration, obj: { [k: string]: string }) {
    for (const k of Object.keys(obj)) {
      (style as any)[k] = obj[k];
    }
  }

  clearFormatting() {
    const root = this.editableRef.nativeElement;
    const html = root.innerText || '';
    root.innerHTML = html.replace(/\n/g, '<br>');
    this.savedSelection = null;
    this.selectedCharCount = 0;
    this.chdRef.detectChanges();
  }

  // ✅ آپدیت کردن state های toolbar بر اساس selection
  updateToolbarState() {
    const sel = this.doc.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const node = sel.anchorNode as Node | null;
    const el = this.findParentElement(node);

    if (el) {
      const st = window.getComputedStyle(el as Element);
      this.textColor = this.ensureColorHex(st.color) || this.textColor;
      this.bgColor = this.ensureColorHex(st.backgroundColor) || this.bgColor;

      const fontFamily = st.fontFamily.replace(/['"]/g, '').split(',')[0].trim();
      if (this.fontFamilies.includes(fontFamily)) {
        this.fontFamily = fontFamily;
      }

      const fontSize = parseInt(st.fontSize);
      if (!isNaN(fontSize) && this.fontSizes.includes(fontSize)) {
        this.fontSize = fontSize;
      }
    }
  }

  onKeyUp() {
    this.saveSelection(); // ✅ ذخیره selection
  }

  findParentElement(n: Node | null): HTMLElement | null {
    while (n && n.nodeType !== Node.ELEMENT_NODE) {
      n = n.parentNode;
    }
    return (n as HTMLElement) || null;
  }

  ensureColorHex(colorStr: string | null): string | null {
    if (!colorStr) return null;

    const m = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (m) {
      const r = parseInt(m[1]).toString(16).padStart(2, '0');
      const g = parseInt(m[2]).toString(16).padStart(2, '0');
      const b = parseInt(m[3]).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }

    return colorStr;
  }

  findParentSpan(node: Node | null): HTMLSpanElement | null {
    while (node) {
      if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'SPAN') {
        return node as HTMLSpanElement;
      }
      node = node.parentNode!;
    }
    return null;
  }

  getValue() {
    const html = this.editableRef.nativeElement.innerHTML;
    return html.replace(/\u200B/g, '').replace(/<span[^>]*>\s*<\/span>/g, '');
  }

  onInsert(ev: string) {
    console.log('Inserted:', ev);
  }

  ok() {
    this.dialogRef.close(this.getValue());
  }
}
