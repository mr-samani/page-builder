import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  forwardRef,
  Injector,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { PosValue, Spacing } from './SpacingModel';
import { SpacingFormatter } from './SpacingFormatter';
import { parseSpacingValues, validateSpacing } from './validateSpacing';
import { CommonModule } from '@angular/common';
import { BaseControl } from '../base-control';

@Component({
  selector: 'spacing-control',
  templateUrl: './spacing-control.component.html',
  styleUrls: ['./spacing-control.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SpacingControlComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
})
export class SpacingControlComponent extends BaseControl implements OnInit, ControlValueAccessor {
  @Input() currentClassName = '';

  @Output() change = new EventEmitter<Partial<CSSStyleDeclaration>>();

  padding = new Spacing();
  margin = new Spacing();

  constructor(
    injector: Injector,
    private cdr: ChangeDetectorRef,
  ) {
    super(injector);
  }

  ngOnInit() {}
  writeValue(style: Partial<CSSStyleDeclaration>): void {
    if (!style) {
      style = {};
    }
    this.style = style;
    // Parse margin and padding from input

    this.margin = parseSpacingValues(style.margin);
    this.padding = parseSpacingValues(style.padding);
    this.cdr.detectChanges();
  }

  onChangeUnit(spacing: Spacing, direction: 'top' | 'right' | 'bottom' | 'left') {
    if (spacing[direction] && spacing[direction].unit == 'auto') {
      spacing[direction].value = 'auto';
    }
    this.update();
  }
  update() {
    // Validate and format spacing values
    const validatedMargin = validateSpacing(this.margin, true);
    const validatedPadding = validateSpacing(this.padding, false);

    // Update style object with formatted CSS values
    this.style.padding = SpacingFormatter.formatSpacingToCSS(validatedPadding);
    this.style.margin = SpacingFormatter.formatSpacingToCSS(validatedMargin);

    this.onChange(this.style);
    this.change.emit(this.style);
    this.cls.updateClass(this.currentClassName, this.style);
  }

  clear(spacing: PosValue) {
    spacing.value = undefined;
    spacing.unit = 'px';
    this.update();
  }
  returnZero() {
    return 0;
  }
}
