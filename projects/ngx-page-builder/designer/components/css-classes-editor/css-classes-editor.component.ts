import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef,
  forwardRef,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  ViewEncapsulation,
  OnDestroy,
  Injector,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';

interface ValidationError {
  line: number;
  message: string;
}

@Component({
  selector: 'css-classes-editor',
  templateUrl: './css-classes-editor.component.html',
  styleUrls: ['./css-classes-editor.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CssClassesEditorComponent),
      multi: true,
    },
  ],
  standalone: true,
  imports: [FormsModule],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CssClassesEditorComponent
  implements OnInit, AfterViewInit, ControlValueAccessor, OnDestroy
{
  @ViewChild('editorTextarea', { static: false }) textareaRef?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('highlightDiv', { static: false }) highlightRef?: ElementRef<HTMLDivElement>;

  textCss = '';
  validationErrors: ValidationError[] = [];
  isDisabled = false;
  private updateTimeout?: any;
  private onChange: (value: Record<string, string> | null) => void = () => {};
  onTouched: () => void = () => {};

  constructor(private cdr: ChangeDetectorRef) {}

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

  // Convert Record to CSS format
  private recordToCss(classes?: Record<string, string>): string {
    if (!classes || Object.keys(classes).length === 0) {
      return '';
    }

    const cssLines: string[] = [];

    Object.entries(classes).forEach(([selector, styles]) => {
      cssLines.push(`${selector} {`);

      // Parse and format styles
      const styleDeclarations = styles
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s);

      styleDeclarations.forEach((declaration) => {
        const [property, value] = declaration.split(':').map((s) => s.trim());
        if (property && value) {
          cssLines.push(`  ${property}: ${value};`);
        }
      });

      cssLines.push('}');
      cssLines.push(''); // Empty line between classes
    });

    return cssLines.join('\n').trim();
  }

  // Check if a string is a valid CSS selector
  private isValidSelector(selector: string): boolean {
    // این regex همه نوع selector های CSS رو میپذیره:
    // .class, #id, element, [attr], :pseudo, ::pseudo, combinations و ...
    const selectorPattern = /^[a-zA-Z0-9_\-#.\[\]:*>+~\s,"'=()]+$/;
    return selectorPattern.test(selector.trim());
  }

  // Convert CSS format to Record
  private cssToRecord(css: string): {
    record: Record<string, string> | null;
    errors: ValidationError[];
  } {
    const errors: ValidationError[] = [];
    const record: Record<string, string> = {};

    if (!css.trim()) {
      return { record: null, errors: [] };
    }

    const lines = css.split('\n');
    let currentSelector: string | null = null;
    let currentStyles: string[] = [];
    let braceCount = 0;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const lineNumber = index + 1;

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('/*')) {
        return;
      }

      // Selector با آکولاد باز - همه نوع selector ها
      if (trimmed.includes('{') && !trimmed.startsWith('{')) {
        // Save previous class if exists
        if (currentSelector && currentStyles.length > 0) {
          record[currentSelector] = currentStyles.join(';');
          currentStyles = [];
        }

        // Extract selector (everything before {)
        const match = trimmed.match(/^(.+?)\s*\{/);
        if (match) {
          const selector = match[1].trim();

          if (this.isValidSelector(selector)) {
            currentSelector = selector;
            braceCount++;
          } else {
            errors.push({
              line: lineNumber,
              message: 'Invalid selector format',
            });
          }
        } else {
          errors.push({
            line: lineNumber,
            message: 'Invalid selector format',
          });
        }
        return;
      }

      // Closing brace
      if (trimmed === '}') {
        if (braceCount === 0) {
          errors.push({
            line: lineNumber,
            message: 'Unexpected closing brace',
          });
        } else {
          braceCount--;

          // Save current class
          if (currentSelector && currentStyles.length > 0) {
            record[currentSelector] = currentStyles.join(';');
            currentStyles = [];
            currentSelector = null;
          }
        }
        return;
      }

      // CSS property
      if (currentSelector && trimmed.includes(':')) {
        const declarationMatch = trimmed.match(/^([a-z-\d]+)\s*:\s*([^;]+);?$/i);

        if (declarationMatch) {
          const [, property, value] = declarationMatch;
          currentStyles.push(`${property.trim()}:${value.trim()}`);
        } else {
          errors.push({
            line: lineNumber,
            message: 'Invalid CSS property format (expected: property: value;)',
          });
        }
        return;
      }

      // Invalid line
      if (trimmed) {
        errors.push({
          line: lineNumber,
          message: 'Invalid CSS syntax',
        });
      }
    });

    // Check for unclosed braces
    if (braceCount > 0) {
      errors.push({
        line: lines.length,
        message: 'Missing closing brace',
      });
    }

    return {
      record: errors.length === 0 ? record : null,
      errors,
    };
  }

  // ControlValueAccessor implementation
  writeValue(classes: Record<string, string> | null): void {
    this.textCss = this.recordToCss(classes || {});
    this.validate();
    this.updateHighlight();
    this.cdr.detectChanges();
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
    if (this.textareaRef) {
      this.textareaRef.nativeElement.disabled = isDisabled;
    }
    this.cdr.detectChanges();
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

    // Debounce validation and update
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    this.updateTimeout = setTimeout(() => {
      this.validate();
      this.update();
    }, 300);
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
    }
  }

  private validate() {
    const { record, errors } = this.cssToRecord(this.textCss);
    this.validationErrors = errors;
    this.cdr.detectChanges();
  }

  private update() {
    const { record, errors } = this.cssToRecord(this.textCss);

    if (errors.length === 0) {
      this.onChange(record);
    } else {
      // Don't update if there are errors, but still notify
      this.onChange(null);
    }
  }

  private updateHighlight() {
    if (!this.highlightRef) return;
    this.highlightRef.nativeElement.innerHTML = this.highlightCSS(this.textCss);
  }

  private highlightCSS(css: string): string {
    if (!css) {
      return '<span class="css-placeholder">/* Enter CSS classes here\nExample:\n.btn {\n  border: 1px solid red;\n  color: red;\n}\n*/</span>';
    }

    let escaped = css.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lines = escaped.split('\n');

    const highlighted = lines.map((line, index) => {
      // برای خطوط خالی، فقط یک newline برمیگردونیم
      // اما اگر آخرین خط باشه و خالی باشه، div.new-line میذاریم
      if (!line.trim()) {
        return '<span class="new-line">&nbsp;</span>';
      }

      const trimmed = line.trim();

      // Comment
      if (trimmed.startsWith('/*')) {
        return `<span class="css-comment">${line}</span>`;
      }

      // Selector با آکولاد - همه نوع selector ها رو پشتیبانی میکنه
      if (trimmed.includes('{') && !trimmed.startsWith('{')) {
        const match = line.match(/^(\s*)(.+?)(\s*)(\{)(.*)$/);
        if (match) {
          const [, leadingSpace, selector, spaceAfterSelector, brace, rest] = match;

          // Highlight different parts of complex selectors
          const highlightedSelector = this.highlightSelector(selector);

          return (
            `${leadingSpace}${highlightedSelector}${spaceAfterSelector}` +
            `<span class="css-brace">${brace}</span>${rest}`
          );
        }
      }

      // Closing brace
      if (trimmed === '}') {
        return line.replace('}', '<span class="css-brace">}</span>');
      }

      // CSS property: value
      const match = line.match(/^(\s*)([a-z-\d]+)(\s*):(\s*)([^;]+)(;?)(.*)$/i);
      if (match) {
        const [, leadingSpace, property, spaceAfter, spaceBefore, value, semicolon, trailing] =
          match;

        const isInvalid = !semicolon.trim();
        const invalidClass = isInvalid ? ' css-invalid' : '';
        const highlightedValue = this.highlightValue(value);

        return (
          `${leadingSpace}<span class="css-property${invalidClass}">${property}</span>` +
          `${spaceAfter}<span class="css-colon">:</span>${spaceBefore}` +
          `<span class="css-value${invalidClass}">${highlightedValue}</span>` +
          `<span class="css-semicolon${invalidClass}">${semicolon}</span>${trailing}`
        );
      }

      // Invalid line
      return `<span class="css-invalid">${line}</span>`;
    });

    return highlighted.join('\n');
  }

  // Highlight different parts of CSS selector
  private highlightSelector(selector: string): string {
    let result = selector;

    // Class selectors
    result = result.replace(
      /(\.[a-zA-Z0-9_-]+)/g,
      '<span class="css-selector css-class">$1</span>',
    );

    // ID selectors
    result = result.replace(/(#[a-zA-Z0-9_-]+)/g, '<span class="css-selector css-id">$1</span>');

    // Attribute selectors
    result = result.replace(/(\[[^\]]+\])/g, '<span class="css-selector css-attribute">$1</span>');

    // Pseudo-classes and pseudo-elements
    result = result.replace(
      /(::?[a-zA-Z-]+(?:\([^)]*\))?)/g,
      '<span class="css-selector css-pseudo">$1</span>',
    );

    // اگر هیچ کدوم از بالایی‌ها نبود، احتمالا element selector هست
    if (!result.includes('<span')) {
      result = `<span class="css-selector css-element">${result}</span>`;
    }

    return result;
  }

  private highlightValue(value: string): string {
    value = value.trim();

    // Hex colors
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

    // Keywords
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

    // Multiple values
    if (value.includes(' ')) {
      const parts = value.split(' ').map((part) => this.highlightValue(part));
      return parts.join(' ');
    }

    // Color names or custom values
    if (/^[a-z]+$/i.test(value)) {
      return `<span class="css-keyword">${value}</span>`;
    }

    return value;
  }

  get hasErrors(): boolean {
    return this.validationErrors.length > 0;
  }
}
