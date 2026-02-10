// ngx-dynamic-autocomplete.directive.ts
import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  Renderer2,
  EventEmitter,
  Output,
  OnDestroy,
  Inject,
  DOCUMENT,
} from '@angular/core';
import { DynamicDataStructure, DynamicValueType } from "ngx-page-builder/core";

@Directive({
  selector: '[ngxDynamicAutocomplete]',
  standalone: true,
})
export class DynamicAutocompleteDirective implements OnDestroy {
  @Input() dynamicData?: DynamicDataStructure[];
  @Output() inserted = new EventEmitter<string>();

  private popupEl?: HTMLElement;
  private suggestions: string[] = [];
  private activeIndex = 0;
  private showPopup = false;

  // close popup when clicking outside
  private onDocClick = (e: MouseEvent) => {
    if (!this.popupEl) return;
    if (
      !this.popupEl.contains(e.target as Node) &&
      !this.el.nativeElement.contains(e.target as Node)
    ) {
      this.closePopup();
    }
  };

  constructor(
    private el: ElementRef<HTMLElement>,
    @Inject(DOCUMENT) private doc: Document,
    private renderer: Renderer2,
  ) {
    this.doc.addEventListener('click', this.onDocClick, true);
  }

  ngOnDestroy() {
    this.doc.removeEventListener('click', this.onDocClick, true);
    this.closePopup();
  }

  // -------------------------
  // Key handling
  // -------------------------
  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    // open suggestions via Ctrl+Space
    if (event.ctrlKey && (event.code === 'Space' || event.key === ' ')) {
      event.preventDefault();
      setTimeout(() => this.openSuggestionsAtCursor(), 0);
      return;
    }

    // navigation when popup open
    if (this.showPopup) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.activeIndex = (this.activeIndex + 1) % this.suggestions.length;
        this.updateHighlight();
        return;
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.activeIndex =
          (this.activeIndex - 1 + this.suggestions.length) % this.suggestions.length;
        this.updateHighlight();
        return;
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (this.suggestions.length) this.select(this.suggestions[this.activeIndex]);
        return;
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.closePopup();
        return;
      }
    }

    // If user types '.' we re-open suggestions
    if (event.key === '.') {
      setTimeout(() => this.openSuggestionsAtCursor(), 0);
      return;
    }

    // For normal typing / deletion, if popup is open we recompute suggestions
    setTimeout(() => {
      if (this.showPopup) {
        const path = this.computePathBeforeCursor();
        const sugg = this.getSuggestionsForPath(path);
        if (!sugg.length) {
          this.closePopup();
        } else {
          this.suggestions = sugg;
          this.activeIndex = Math.min(this.activeIndex, this.suggestions.length - 1);
          this.updatePopupItems();
          const r = this.getCaretRect();
          this.setPosition(r.left, r.bottom);
        }
      }
    }, 0);
  }

  @HostListener('blur')
  onBlur() {
    setTimeout(() => this.closePopup(), 150);
  }

  // -------------------------
  // Opening & computing
  // -------------------------
  private openSuggestionsAtCursor() {
    const path = this.computePathBeforeCursor();
    const suggestions = this.getSuggestionsForPath(path);

    console.log('🔍 Debug Info:', {
      textBefore: this.getTextBeforeCursor(),
      path: path,
      suggestions: suggestions,
    });

    if (!suggestions || !suggestions.length) {
      this.closePopup();
      return;
    }
    this.suggestions = suggestions;
    this.activeIndex = 0;
    this.createOrUpdatePopup();
    const rect = this.getCaretRect();
    this.setPosition(rect.left, rect.bottom);
    this.showPopup = true;
  }

  /**
   * IMPROVED: Get text before cursor - works with HTML editors
   */
  private getTextBeforeCursor(): string {
    const el = this.el.nativeElement;

    if ((el as HTMLElement).isContentEditable) {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return '';

      const range = sel.getRangeAt(0);
      const preRange = this.doc.createRange();
      preRange.selectNodeContents(el);
      preRange.setEnd(range.endContainer, range.endOffset);

      // Get text content - this handles <br>, <p>, and other HTML elements
      let text = preRange.cloneContents().textContent || '';

      // Normalize line breaks
      text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      return text;
    } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const pos = el.selectionStart ?? 0;
      return el.value.slice(0, pos);
    }
    return '';
  }

  /**
   * IMPROVED: Compute path - robust line handling
   */
  private computePathBeforeCursor(): string[] {
    const textBefore = this.getTextBeforeCursor();

    console.log('📝 Text before cursor:', JSON.stringify(textBefore));

    if (!textBefore) return [];

    // Split by actual line breaks
    const lines = textBefore.split('\n');
    const currentLine = lines[lines.length - 1] || '';

    console.log('📄 Current line:', JSON.stringify(currentLine));
    console.log('📊 Total lines:', lines.length);

    // If current line is empty or only whitespace -> root suggestions
    const trimmedLine = currentLine.trim();
    if (!trimmedLine) {
      console.log('✅ Empty line - showing root');
      return [];
    }

    // Extract the rightmost path chain from current line
    // This regex matches: word.word.[index].word etc at the END of line
    const pathRegex = /(?:[\w$]+|\[index\])(?:\.(?:[\w$]+|\[index\]))*\.?$/;
    const match = trimmedLine.match(pathRegex);

    if (!match) {
      console.log('❌ No path match in line');
      return [];
    }

    const chain = match[0];
    console.log('🔗 Found chain:', chain);

    // Handle edge case: just a dot
    if (chain === '.') {
      return [];
    }

    // Split and clean
    const segments = chain.split('.');
    const result: string[] = [];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i].trim();
      // Skip empty segments except the last one
      if (seg || i === segments.length - 1) {
        result.push(seg);
      }
    }

    console.log('🎯 Final path:', result);
    return result;
  }

  /**
   * Get current token for filtering
   */
  private getCurrentToken(): string {
    const textBefore = this.getTextBeforeCursor();
    if (!textBefore) return '';

    const lines = textBefore.split('\n');
    const currentLine = lines[lines.length - 1] || '';

    // Get last word/token
    const match = currentLine.replace(/[\s.]+$/, '').match(/[\w$]+$/);
    return match ? match[0] : '';
  }

  // -------------------------
  // Suggestions computation
  // -------------------------
  private getSuggestionsForPath(path: string[]): string[] {
    const root = this.dynamicData ?? {};

    // Empty path -> top-level keys
    if (!path || path.length === 0) {
      const keys = Object.keys(root);
      console.log('🌳 Root keys:', keys);
      return keys;
    }

    // Traverse to parent
    const parentPath = path.slice(0, -1);
    const currentToken = path[path.length - 1] || '';

    console.log('🔍 Parent path:', parentPath);
    console.log('🔍 Current token:', currentToken);

    // Start from synthetic root
    let current: DynamicDataStructure = root as DynamicDataStructure;

    // Traverse parent path
    for (const seg of parentPath) {
      if (!current) {
        console.log('❌ Current is null at segment:', seg);
        return [];
      }

      if (current.type === DynamicValueType.Object) {
        if (current.values && seg in current.values) {
          current = current.values.find((x: DynamicDataStructure) => x.name == seg)!;
          console.log('✅ Navigated to object property:', seg);
        } else {
          console.log('❌ Property not found:', seg);
          return [];
        }
      } else if (current.type === DynamicValueType.Array) {
        // Handle array navigation
        // // // if (seg === '[index]') {
        // // //   current = current.values;
        // // //   console.log('✅ Navigated to array items');
        // // // } else if (current.items && current.items.type === DynamicValueType.Object) {
        // // //   if (current.items.values && seg in current.items.values) {
        // // //     current = current.items.values.find((x:DynamicDataStructure) => x.name == seg)!;
        // // //     console.log('✅ Navigated to array item property:', seg);
        // // //   } else {
        // // //     console.log('❌ Array item property not found:', seg);
        // // //     return [];
        // // //   }
        // // // } else {
        // // //   console.log('❌ Cannot navigate array with segment:', seg);
        // // //   return [];
        // // // }
      } else {
        console.log('❌ Cannot navigate value node');
        return [];
      }
    }

    // Get suggestions from current node
    if (!current) return [];

    let suggestions: string[] = [];

    if (current.type === DynamicValueType.Object) {
      const keys = Object.keys(current.values || {});

      if (!currentToken) {
        // Show all keys
        suggestions = keys;
      } else {
        // Filter by prefix
        suggestions = keys.filter((k) => k.toLowerCase().startsWith(currentToken.toLowerCase()));
      }
    } else if (current.type === DynamicValueType.Array) {
      // Suggest [index]
      if (!currentToken || '[index]'.toLowerCase().startsWith(currentToken.toLowerCase())) {
        suggestions.push('[index]');
      }

      // Suggest item properties
      if (current.values) {
        const itemKeys = Object.keys(current.values || {});
        if (!currentToken) {
          suggestions.push(...itemKeys);
        } else {
          suggestions.push(
            ...itemKeys.filter((k) => k.toLowerCase().startsWith(currentToken.toLowerCase())),
          );
        }
      }
    }

    console.log('💡 Suggestions:', suggestions);
    return suggestions;
  }

  // -------------------------
  // Popup DOM
  // -------------------------
  private createOrUpdatePopup() {
    if (!this.popupEl) {
      const popup = this.renderer.createElement('ul');
      this.renderer.setStyle(popup, 'position', 'fixed');
      this.renderer.setStyle(popup, 'z-index', '999999');
      this.renderer.setStyle(popup, 'background', '#fff');
      this.renderer.setStyle(popup, 'border', '1px solid #ccc');
      this.renderer.setStyle(popup, 'border-radius', '4px');
      this.renderer.setStyle(popup, 'box-shadow', '0 4px 12px rgba(0,0,0,0.15)');
      this.renderer.setStyle(popup, 'list-style', 'none');
      this.renderer.setStyle(popup, 'margin', '0');
      this.renderer.setStyle(popup, 'padding', '4px 0');
      this.renderer.setStyle(popup, 'font-family', 'monospace');
      this.renderer.setStyle(popup, 'font-size', '13px');
      this.renderer.setStyle(popup, 'max-height', '250px');
      this.renderer.setStyle(popup, 'overflow', 'auto');
      this.renderer.setStyle(popup, 'min-width', '150px');
      this.renderer.appendChild(this.doc.body, popup);
      this.popupEl = popup;
    }
    this.updatePopupItems();
  }

  private updatePopupItems() {
    if (!this.popupEl) return;

    while (this.popupEl.firstChild) {
      this.popupEl.removeChild(this.popupEl.firstChild);
    }

    this.suggestions.forEach((sugg, idx) => {
      const li = this.renderer.createElement('li');
      this.renderer.setStyle(li, 'padding', '6px 12px');
      this.renderer.setStyle(li, 'cursor', 'pointer');
      this.renderer.setStyle(li, 'transition', 'all 0.15s');
      this.renderer.setProperty(li, 'innerText', sugg);

      this.renderer.listen(li, 'mouseenter', () => {
        this.activeIndex = idx;
        this.updateHighlight();
      });

      this.renderer.listen(li, 'click', () => this.select(sugg));

      if (idx === this.activeIndex) {
        this.renderer.setStyle(li, 'background', '#0078d7');
        this.renderer.setStyle(li, 'color', '#fff');
      }

      this.renderer.appendChild(this.popupEl!, li);
    });
  }

  private updateHighlight() {
    if (!this.popupEl) return;
    const children = Array.from(this.popupEl.children) as HTMLElement[];
    children.forEach((c, i) => {
      this.renderer.setStyle(c, 'background', i === this.activeIndex ? '#0078d7' : '');
      this.renderer.setStyle(c, 'color', i === this.activeIndex ? '#fff' : '#000');
    });
    const activeEl = children[this.activeIndex];
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  private setPosition(x: number, y: number) {
    if (!this.popupEl) return;

    // Force layout calculation
    this.popupEl.style.display = 'block';
    const popupRect = this.popupEl.getBoundingClientRect();
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    let left = Math.max(8, Math.min(x, winW - popupRect.width - 8));
    let top = y + 4;

    // Flip up if no space below
    if (top + popupRect.height > winH - 20) {
      top = Math.max(8, y - popupRect.height - 4);
    }

    this.renderer.setStyle(this.popupEl, 'left', `${left}px`);
    this.renderer.setStyle(this.popupEl, 'top', `${top}px`);
  }

  private closePopup() {
    if (this.popupEl) {
      try {
        this.renderer.removeChild(this.doc.body, this.popupEl);
      } catch {}
      this.popupEl = undefined;
    }
    this.showPopup = false;
    this.suggestions = [];
    this.activeIndex = 0;
  }

  // -------------------------
  // Insert logic
  // -------------------------
  private select(value: string) {
    this.replaceCurrentTokenWith(value);
    this.inserted.emit(value);
    this.closePopup();
  }

  private replaceCurrentTokenWith(textToInsert: string) {
    const el = this.el.nativeElement;

    if ((el as HTMLElement).isContentEditable) {
      // For contenteditable, use Selection API
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;

      const range = sel.getRangeAt(0);

      // Get text before cursor in current text node
      const textNode = range.startContainer;
      const offset = range.startOffset;

      if (textNode.nodeType === Node.TEXT_NODE) {
        const textBefore = (textNode.textContent || '').slice(0, offset);
        const textAfter = (textNode.textContent || '').slice(offset);

        // Find the chain to replace
        const chainMatch = textBefore.match(/(?:[\w$]+|\[index\])(?:\.(?:[\w$]+|\[index\]))*$/);

        if (chainMatch) {
          const chainStart = offset - chainMatch[0].length;
          const newText =
            textBefore.slice(0, textBefore.length - chainMatch[0].length) +
            textToInsert +
            textAfter;

          textNode.textContent = newText;

          // Set cursor position
          const newOffset = chainStart + textToInsert.length;
          range.setStart(textNode, newOffset);
          range.setEnd(textNode, newOffset);
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          // Just insert at cursor
          range.deleteContents();
          range.insertNode(this.doc.createTextNode(textToInsert));
          range.collapse(false);
        }
      } else {
        // Fallback: insert at cursor
        range.deleteContents();
        range.insertNode(this.doc.createTextNode(textToInsert));
        range.collapse(false);
      }

      // Trigger input event
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const start = el.selectionStart ?? 0;
      const value = el.value;
      const before = value.slice(0, start);
      const after = value.slice(start);

      // Find chain in current line
      const lines = before.split('\n');
      const currentLine = lines[lines.length - 1] || '';
      const chainMatch = currentLine.match(/(?:[\w$]+|\[index\])(?:\.(?:[\w$]+|\[index\]))*$/);

      if (chainMatch) {
        const lineStart = before.length - currentLine.length;
        const chainStart = lineStart + currentLine.lastIndexOf(chainMatch[0]);

        el.value = value.slice(0, chainStart) + textToInsert + after;
        const newPos = chainStart + textToInsert.length;
        el.setSelectionRange(newPos, newPos);
      } else {
        el.setRangeText(textToInsert, start, start, 'end');
      }

      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // -------------------------
  // Caret rect
  // -------------------------
  private getCaretRect(): DOMRect {
    const el = this.el.nativeElement;

    if ((el as HTMLElement).isContentEditable) {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) {
        const rect = el.getBoundingClientRect();
        return new DOMRect(rect.left, rect.top, 0, 0);
      }

      const range = sel.getRangeAt(0);
      const rects = range.getClientRects();

      if (rects.length > 0) {
        return rects[0];
      }

      // Fallback: create a temporary span at cursor
      const span = this.doc.createElement('span');
      span.textContent = '\u200B'; // zero-width space
      range.insertNode(span);
      const rect = span.getBoundingClientRect();
      span.parentNode?.removeChild(span);

      return rect;
    } else if (el instanceof HTMLTextAreaElement) {
      return this.getTextareaCaretRect(el);
    } else if (el instanceof HTMLInputElement) {
      const rect = el.getBoundingClientRect();
      return new DOMRect(rect.left + 8, rect.bottom, 0, 0);
    }

    return new DOMRect();
  }

  private getTextareaCaretRect(textarea: HTMLTextAreaElement): DOMRect {
    const rect = textarea.getBoundingClientRect();
    const style = window.getComputedStyle(textarea);

    const mirror = this.doc.createElement('div');
    const props = [
      'boxSizing',
      'width',
      'height',
      'overflowX',
      'overflowY',
      'borderTopWidth',
      'borderRightWidth',
      'borderBottomWidth',
      'borderLeftWidth',
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
      'fontStyle',
      'fontVariant',
      'fontWeight',
      'fontSize',
      'fontFamily',
      'lineHeight',
      'letterSpacing',
      'wordSpacing',
      'textAlign',
      'whiteSpace',
      'wordWrap',
    ];

    props.forEach((prop) => {
      mirror.style[prop as any] = style[prop as any];
    });

    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.top = '0';
    mirror.style.left = '-9999px';
    mirror.style.whiteSpace = 'pre-wrap';

    this.doc.body.appendChild(mirror);

    const start = textarea.selectionStart || 0;
    mirror.textContent = textarea.value.substring(0, start);

    const span = this.doc.createElement('span');
    span.textContent = '|';
    mirror.appendChild(span);

    const spanRect = span.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();

    this.doc.body.removeChild(mirror);

    const x = rect.left + (spanRect.left - mirrorRect.left) - (textarea.scrollLeft || 0);
    const y = rect.top + (spanRect.top - mirrorRect.top) - (textarea.scrollTop || 0);

    return new DOMRect(x, y + parseFloat(style.fontSize || '16'), 0, 0);
  }
}
