import { Renderer2, inject, DOCUMENT } from '@angular/core';
import { ClassManagerService } from '../services/class-manager.service';

export abstract class BaseControl {
  protected readonly doc = inject(DOCUMENT);

  protected readonly renderer = inject(Renderer2);
  style!: Partial<CSSStyleDeclaration>;
  isDisabled: boolean = false;
  onChange = (_: Partial<CSSStyleDeclaration>) => {};
  onTouched = () => {};

  cls = inject(ClassManagerService);
  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }
}
