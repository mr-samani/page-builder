import { Renderer2, inject, DOCUMENT } from '@angular/core';

export abstract class BaseControl {
  protected readonly doc = inject(DOCUMENT);

  protected readonly renderer = inject(Renderer2);
  style!: Partial<CSSStyleDeclaration>;
  isDisabled: boolean = false;
  onChange = (_: Partial<CSSStyleDeclaration>) => {};
  onTouched = () => {};

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
