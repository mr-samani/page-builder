import { CommonModule } from '@angular/common';
import { Component, forwardRef, inject, input, OnInit, output } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NgxInputColor } from 'ngx-input-color/color-picker';
import { NgxInputGradient } from 'ngx-input-color/gradient-picker';
import { CssValueType, ICssVariable } from 'ngx-page-builder/core';
import { MenuDialog } from '../../extensions/menu-dialog/menu-dialog.component';
import { SvgIconDirective } from '../../directives/svg-icon.directive';
import { Dialog } from '../../extensions/dialog';
import { ClassManagerService } from '../../services/class-manager.service';

@Component({
  selector: 'input-css',
  templateUrl: './input-css.component.html',
  styleUrls: ['./input-css.component.scss'],
  imports: [CommonModule, FormsModule, NgxInputColor, NgxInputGradient, MenuDialog, SvgIconDirective],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputCssComponent),
      multi: true,
    },
  ],
})
export class InputCssComponent implements OnInit, ControlValueAccessor {
  type = input<CssValueType>('text');
  title = input<string>('');

  value?: string;

  public valueChange = output<string | undefined>();

  private _onChange = (val?: string) => {};
  private _onChangeValidate = () => {};
  private _onTouched = () => {};
  disabled = false;

  filterCssVar = '';
  filteredCssVars: ICssVariable[] = [];

  thisIsVariable = false;
  variableName = '';

  cls = inject(ClassManagerService);
  constructor() {}

  ngOnInit() {
    this.searchCssVariable();
  }
  writeValue(val?: string): void {
    this.value = val;
    this.getVariableName();
  }
  registerOnChange(fn: any): void {
    this._onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this._onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  clear() {
    this.value = undefined;
    this.getVariableName();

    this.onChange();
  }
  onChange() {
    this.getVariableName();
    this._onChange(this.value);
    this.valueChange.emit(this.value);
  }

  openCssVariableDialog(menuDialog: MenuDialog) {
    menuDialog.showModal();
  }

  /*---------------------CSS Variables----------------------------------*/
  private getVariableName() {
    if (!this.value) {
      this.thisIsVariable = false;
      this.variableName = '';
      return;
    }
    this.thisIsVariable = this.value.trim().startsWith('var(--') == true;
    if (this.thisIsVariable) {
      this.variableName = this.value
        .trim()
        .replace('var(--', '')
        .substring(0, this.value.length - 7);
    } else {
      this.variableName = '';
    }

    console.log(this.value, this.thisIsVariable, this.variableName);
  }
  searchCssVariable() {
    this.filteredCssVars = this.cls.cssVariables.filter(
      (x) => x.type == this.type() && x.name.toLowerCase().includes(this.filterCssVar.toLowerCase()),
    );
  }
  selectCssVar(item: ICssVariable, menuDialog: MenuDialog) {
    this.value = `var(--${item.name})`;
    this.onChange();
    menuDialog.closeModal();
  }
  async openCssVariablesDialog(menuDialog: MenuDialog) {
    menuDialog.closeModal();
    const { CssVariablesDialogComponent } =
      await import('../../lib/css-variables-dialog/css-variables-dialog.component');
    Dialog.open(CssVariablesDialogComponent).afterClosed.subscribe(() => this.searchCssVariable());
  }
}
