import { ChangeDetectionStrategy, Component, EventEmitter, forwardRef, Input, OnInit, Output } from '@angular/core';
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
  lineHeight?: number;
  constructor() {
    super();
  }

  ngOnInit() {}
  writeValue(style: Partial<CSSStyleDeclaration>): void {
    if (!style) {
      style = {};
    }
    this.style = style;
    this.fontSize = parseFloat(style.fontSize || '');
    this.lineHeight = parseFloat(style.lineHeight || '');
  }

  update() {
    this.style.fontSize = Number.isNaN(this.fontSize) ? '' : this.fontSize + 'px';
    this.style.lineHeight = Number.isNaN(this.lineHeight) ? '' : this.lineHeight + 'px';

    this.onChange(this.style);
    this.change.emit(this.style);
    this.cls.updateClass(this.currentClassName, this.style);
  }

  clear(property: string) {
    (this.style as any)[property] = undefined;
    this.update();
  }
}
