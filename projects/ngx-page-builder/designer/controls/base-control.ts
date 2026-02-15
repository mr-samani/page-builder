import { Renderer2, Injector, inject } from '@angular/core';
import { ClassManagerService } from '../services/class-manager.service';

export abstract class BaseControl {
  style!: Partial<CSSStyleDeclaration>;
  isDisabled: boolean = false;
  onChange = (_: Partial<CSSStyleDeclaration>) => {};
  onTouched = () => {};

  readonly renderer: Renderer2;

  cls = inject(ClassManagerService);
  constructor(injector: Injector) {
    this.renderer = injector.get(Renderer2);
  }

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
