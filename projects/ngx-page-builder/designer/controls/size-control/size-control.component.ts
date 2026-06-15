import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  forwardRef,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BaseControl } from '../base-control';

export interface ISizeModel {
  width: string;
  minWidth: string;
  maxWidth: string;
  height: string;
  minHeight: string;
  maxHeight: string;
}

export interface ISizeValue {
  value: number | string | undefined;
  unit: 'px' | '%' | 'em' | 'rem' | 'vh' | 'vw' | 'auto';
}

export type SizeProperty = 'width' | 'minWidth' | 'maxWidth' | 'height' | 'minHeight' | 'maxHeight';

@Component({
  selector: 'size-control',
  templateUrl: './size-control.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SizeControlComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
})
export class SizeControlComponent extends BaseControl implements OnInit, ControlValueAccessor {
  @Input() currentClassName = '';

  @Output() change = new EventEmitter<Partial<CSSStyleDeclaration>>();

  widthProperties: SizeProperty[] = ['width', 'minWidth', 'maxWidth'];
  heightProperties: SizeProperty[] = ['height', 'minHeight', 'maxHeight'];

  sizes: {
    width: ISizeValue;
    minWidth: ISizeValue;
    maxWidth: ISizeValue;
    height: ISizeValue;
    minHeight: ISizeValue;
    maxHeight: ISizeValue;
  } = {
    width: { value: undefined, unit: 'px' },
    minWidth: { value: undefined, unit: 'px' },
    maxWidth: { value: undefined, unit: 'px' },
    height: { value: undefined, unit: 'px' },
    minHeight: { value: undefined, unit: 'px' },
    maxHeight: { value: undefined, unit: 'px' },
  };

  constructor(private cdr: ChangeDetectorRef) {
    super();
  }

  ngOnInit() {}

  writeValue(style: Partial<CSSStyleDeclaration>): void {
    if (!style) {
      style = {};
    }
    this.style = style;

    // Parse size values
    this.sizes.width = this.parseSizeValue(this.style.width);
    this.sizes.minWidth = this.parseSizeValue(this.style.minWidth);
    this.sizes.maxWidth = this.parseSizeValue(this.style.maxWidth);
    this.sizes.height = this.parseSizeValue(this.style.height);
    this.sizes.minHeight = this.parseSizeValue(this.style.minHeight);
    this.sizes.maxHeight = this.parseSizeValue(this.style.maxHeight);

    this.cdr.detectChanges();
  }

  parseSizeValue(value: string | undefined): ISizeValue {
    if (!value || value === 'auto' || value === 'none') {
      return { value: value, unit: 'auto' };
    }

    const match = value.match(/^([\d.]+)(px|%|em|rem|vh|vw)$/);
    if (match) {
      return {
        value: parseFloat(match[1]),
        unit: match[2] as ISizeValue['unit'],
      };
    }

    return { value: 0, unit: 'px' };
  }

  formatSizeValue(sizeValue: ISizeValue): string {
    if (sizeValue.value == undefined) return '';
    if (sizeValue.unit === 'auto') {
      return sizeValue.value === 'none' ? 'none' : 'auto';
    }
    return `${sizeValue.value}${sizeValue.unit}`;
  }

  onChangeUnit(property: SizeProperty) {
    const sizeValue = this.sizes[property];
    if (sizeValue.unit === 'auto') {
      if (property.includes('max')) {
        sizeValue.value = 'none';
      } else {
        sizeValue.value = 'auto';
      }
    } else if (typeof sizeValue.value === 'string') {
      sizeValue.value = 0;
    }
    this.update();
  }

  getLabel(property: SizeProperty): string {
    const labels: { [key in SizeProperty]: string } = {
      width: 'Width',
      minWidth: 'Min Width',
      maxWidth: 'Max Width',
      height: 'Height',
      minHeight: 'Min Height',
      maxHeight: 'Max Height',
    };
    return labels[property];
  }

  isMaxProperty(property: SizeProperty): boolean {
    return property === 'maxWidth' || property === 'maxHeight';
  }

  update() {
    // Update style object with formatted CSS values
    this.style.width = this.formatSizeValue(this.sizes.width);
    this.style.minWidth = this.formatSizeValue(this.sizes.minWidth);
    this.style.maxWidth = this.formatSizeValue(this.sizes.maxWidth);
    this.style.height = this.formatSizeValue(this.sizes.height);
    this.style.minHeight = this.formatSizeValue(this.sizes.minHeight);
    this.style.maxHeight = this.formatSizeValue(this.sizes.maxHeight);

    this.onChange(this.style);
    this.change.emit(this.style);
    this.cls.updateClass(this.currentClassName, this.style);
  }
  clear(property: ISizeValue) {
    property.value = undefined;
    property.unit = 'px';
    this.update();
  }
}
