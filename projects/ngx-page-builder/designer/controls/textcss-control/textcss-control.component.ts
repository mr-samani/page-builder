import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  OnInit,
  Output,
  ViewChild,
  AfterViewInit,
  Injector,
  OnDestroy,
  ViewEncapsulation,
  Input,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

import { BaseControl } from '../base-control';
import { parseStyleString } from "ngx-page-builder/core";

@Component({
  selector: 'textcss-control',
  templateUrl: './textcss-control.component.html',
  styleUrls: ['./textcss-control.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextCssControlComponent),
      multi: true,
    },
  ],
  standalone: true,
  imports: [FormsModule],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextCssControlComponent
  extends BaseControl
  implements OnInit, AfterViewInit, ControlValueAccessor, OnDestroy
{
  @Input() currentClassName = '';

  @Output() change = new EventEmitter<Partial<CSSStyleDeclaration>>();
  @ViewChild('editorTextarea', { static: false }) textareaRef?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('highlightDiv', { static: false }) highlightRef?: ElementRef<HTMLDivElement>;

  textCss = '';
  private updateTimeout?: any;

  constructor(
    injector: Injector,
    private cdr: ChangeDetectorRef,
  ) {
    super(injector);
  }

  ngOnInit() {}

  ngAfterViewInit() {
    if (this.textareaRef) {
      this.setupEditor();
    }
  }

  ngOnDestroy() {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
  }

  writeValue(style: Partial<CSSStyleDeclaration>): void {
    if (!style) {
      style = {};
    }
    this.style = style;
    this.textCss = style.cssText?.replace(/;\s*/g, ';\n') ?? '';
    this.updateHighlight();
    this.cdr.detectChanges();
  }

  override setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
    if (this.textareaRef) {
      this.textareaRef.nativeElement.disabled = isDisabled;
    }
  }

  private setupEditor() {
    if (!this.textareaRef) return;

    const textarea = this.textareaRef.nativeElement;

    // Sync scroll between textarea and highlight
    textarea.addEventListener('scroll', () => {
      if (this.highlightRef) {
        this.highlightRef.nativeElement.scrollTop = textarea.scrollTop;
        this.highlightRef.nativeElement.scrollLeft = textarea.scrollLeft;
      }
    });

    // Initial highlight
    this.updateHighlight();
  }

  onInput(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    this.textCss = textarea.value;

    // Update highlight immediately
    this.updateHighlight();
    // Debounce CSS application
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    this.updateTimeout = setTimeout(() => {
      this.update();
    }, 150);
  }

  onKeyDown(event: KeyboardEvent) {
    const textarea = event.target as HTMLTextAreaElement;

    // Handle Tab key
    if (event.key === 'Tab') {
      event.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;

      // Insert 2 spaces
      textarea.value = value.substring(0, start) + '  ' + value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 2;

      // Trigger input event
      this.textCss = textarea.value;
      this.updateHighlight();

      if (this.updateTimeout) {
        clearTimeout(this.updateTimeout);
      }
      this.updateTimeout = setTimeout(() => {
        this.update();
      }, 150);
    }
  }

  private updateHighlight() {
    if (!this.highlightRef) return;
    this.highlightRef.nativeElement.innerHTML = this.highlightCSS(this.textCss);
  }

  private highlightCSS(css: string): string {
    if (!css) return '<span class="css-placeholder">/* Enter CSS styles here */</span>';

    // Escape HTML
    let escaped = css.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Split by lines and process each line
    const lines = escaped.split('\n');
    const highlighted = lines.map((line, index) => {
      // Empty line
      if (!line.trim()) {
        return '<br>';
      }

      // Check for property: value; pattern
      const match = line.match(/^(\s*)([a-z-]+)(\s*):(\s*)([^;]*)(;?)(.*)$/i);

      if (match) {
        const [
          ,
          leadingSpace,
          property,
          spaceAfterProp,
          spaceBeforeValue,
          value,
          semicolon,
          trailing,
        ] = match;

        // Validate
        const isInvalid = !value.trim() || !semicolon;
        const invalidClass = isInvalid ? ' css-invalid' : '';

        const highlightedValue = this.highlightValue(value);

        return (
          `${leadingSpace}<span class="css-property${invalidClass}">${property}</span>` +
          `${spaceAfterProp}<span class="css-colon">:</span>${spaceBeforeValue}` +
          `<span class="css-value${invalidClass}">${highlightedValue}</span>` +
          `<span class="css-semicolon${invalidClass}">${semicolon}</span>${trailing}`
        );
      }

      // Comment
      if (line.trim().startsWith('/*')) {
        return `<span class="css-comment">${line}</span>`;
      }

      // If doesn't match pattern, mark as invalid
      return `<span class="css-invalid">${line}</span>`;
    });

    return highlighted.join('\n');
  }

  private highlightValue(value: string): string {
    value = value.trim();

    // Color values (hex)
    if (/^#[0-9a-fA-F]{3,8}$/.test(value)) {
      return `<span class="css-color">${value}</span>`;
    }

    // Color functions
    if (/^(rgb|rgba|hsl|hsla)\(.+\)$/.test(value)) {
      return `<span class="css-color">${value}</span>`;
    }

    // Numbers with units
    if (/^-?\d+\.?\d*(px|em|rem|%|vh|vw|vmin|vmax|deg|rad|turn|s|ms|ch|ex|fr)?$/i.test(value)) {
      return `<span class="css-number">${value}</span>`;
    }

    // URLs
    if (/^url\(.+\)$/.test(value)) {
      return `<span class="css-url">${value}</span>`;
    }

    // Important
    if (/!important/.test(value)) {
      return value.replace(/!important/, '<span class="css-important">!important</span>');
    }

    // Common keywords
    const keywords = [
      'inherit',
      'initial',
      'unset',
      'revert',
      'auto',
      'none',
      'normal',
      'transparent',
      'currentColor',
      'solid',
      'dashed',
      'dotted',
      'double',
      'block',
      'inline',
      'flex',
      'grid',
      'absolute',
      'relative',
      'fixed',
      'sticky',
      'hidden',
      'visible',
      'bold',
      'italic',
      'center',
      'left',
      'right',
      'top',
      'bottom',
      'middle',
      'baseline',
    ];

    if (keywords.includes(value.toLowerCase())) {
      return `<span class="css-keyword">${value}</span>`;
    }

    // Multiple values (space-separated)
    if (value.includes(' ')) {
      const parts = value.split(' ').map((part) => this.highlightValue(part));
      return parts.join(' ');
    }

    // Default - could be a color name or custom value
    if (/^[a-z]+$/i.test(value)) {
      return `<span class="css-keyword">${value}</span>`;
    }

    return value;
  }

  update() {
    try {
      // Apply styles to element
      this.style = parseStyleString(this.textCss);
      this.style.cssText = this.textCss;
      // Update item
      this.onChange(this.style);
      this.change.emit(this.style);
      this.cls.updateClass(this.currentClassName, this.style);
    } catch (error) {
      console.error('Invalid CSS:', error);
    }

    this.cdr.detectChanges();
  }
}
