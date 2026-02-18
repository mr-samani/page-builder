import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  forwardRef,
  Injector,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

import { BaseControl } from '../base-control';

@Component({
  selector: 'typography-control',
  templateUrl: './typography-control.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TypographyControlComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
})
export class TypographyControlComponent extends BaseControl implements OnInit, ControlValueAccessor {
  @Input() currentClassName = '';

  @Output() change = new EventEmitter<Partial<CSSStyleDeclaration>>();

  fontSize?: number;
  fontFamily: string = '';
  lineHeight?: number;
  textDecoration: string = 'none';
  textTransform: string = 'none';
  textAlign: string = '';
  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit() {}
  writeValue(style: Partial<CSSStyleDeclaration>): void {
    if (!style) {
      style = {};
    }
    this.style = style;
    this.fontSize = parseFloat(style.fontSize || '');
    this.fontFamily = style.fontFamily || '';
    this.lineHeight = parseFloat(style.lineHeight || '');
    this.textDecoration = style.textDecoration || '';
    this.textTransform = style.textTransform || '';
    this.textAlign = style.textAlign || '';

    this.style = {
      fontSize: this.fontSize + 'px',
      fontFamily: this.fontFamily,
      lineHeight: this.lineHeight + 'px',
      textDecoration: this.textDecoration,
      textTransform: this.textTransform,
      textAlign: this.textAlign,
    };
  }

  update() {
    this.style = {
      fontSize: this.fontSize + 'px',
      fontFamily: this.fontFamily,
      lineHeight: this.lineHeight + 'px',
      textDecoration: this.textDecoration,
      textTransform: this.textTransform,
      textAlign: this.textAlign,
    };
    this.onChange(this.style);
    this.change.emit(this.style);
    this.cls.updateClass(this.currentClassName, this.style);
  }

  clear(property: string) {
    (this as any)[property] = undefined;
    this.update();
  }
}
