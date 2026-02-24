// input-group.component.ts
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  forwardRef,
  OnDestroy,
  Output,
  input,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { InputOptionComponent } from './input-option.component';

@Component({
  selector: 'input-group',
  template: '<ng-content></ng-content>',
  styles: [
    `
      :host {
        display: flex;
        border-radius: 5px;
        overflow: hidden;
        margin: 10px 0;
        height: 26px;
      }
    `,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputGroupComponent),
      multi: true,
    },
  ],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InputGroupComponent implements ControlValueAccessor, OnDestroy {
  multiSelect = input<boolean>(false);

  @Output() valueChange = new EventEmitter<any>();

  isDisabled = false;

  private _value: any = null;
  private _options: InputOptionComponent[] = [];

  private _onChange = (_: any) => {};
  private _onTouched = () => {};

  constructor(private cdr: ChangeDetectorRef) {}

  // --- registry (called by InputOptionComponent) ---

  register(option: InputOptionComponent): void {
    this._options.push(option);
    this._syncOption(option);
  }

  unregister(option: InputOptionComponent): void {
    this._options = this._options.filter((o) => o !== option);
  }

  // --- selection logic (called by InputOptionComponent on click) ---

  select(option: InputOptionComponent): void {
    if (this.isDisabled) return;

    if (this.multiSelect()) {
      option.setSelected(!option.selected);

      const values = this._options.filter((o) => o.selected).map((o) => o.value);

      this._value = values;
    } else {
      // deselect همه، select فقط این یکی
      this._options.forEach((o) => o.setSelected(o === option));
      this._value = option.value;
    }

    this._onChange(this._value);
    this._onTouched();
    this.valueChange.emit(this._value);
    this.cdr.markForCheck();
  }

  // --- ControlValueAccessor ---

  writeValue(value: any): void {
    this._value = value ?? null;
    this._syncAll();
    this.cdr.markForCheck();
  }

  registerOnChange(fn: any): void {
    this._onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this._onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
    this._options.forEach((o) => o.setDisabled(isDisabled));
    this.cdr.markForCheck();
  }

  // --- private helpers ---

  private _syncAll(): void {
    this._options.forEach((o) => this._syncOption(o));
  }

  private _syncOption(option: InputOptionComponent): void {
    if (this.multiSelect()) {
      const arr = Array.isArray(this._value) ? this._value : [];
      option.setSelected(arr.includes(option.value));
    } else {
      option.setSelected(this._value === option.value);
    }
  }

  ngOnDestroy(): void {
    this._options = [];
  }
}
