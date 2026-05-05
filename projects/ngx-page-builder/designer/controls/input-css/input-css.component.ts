import { CommonModule } from '@angular/common';
import { Component, EventEmitter, forwardRef, inject, input, OnInit, output } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NgxInputColor } from 'ngx-input-color/color-picker';
import { NgxInputGradient } from 'ngx-input-color/gradient-picker';
import { CssValueType, ICssVariable } from 'ngx-page-builder/core';
import { MenuDialog } from '../../extensions/menu-dialog/menu-dialog.component';
import { SvgIconDirective } from '../../directives/svg-icon.directive';
import { PageBuilderService } from '../../services/page-builder.service';
import { Dialog } from '../../extensions/dialog';

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
  pb = inject(PageBuilderService);
  constructor() {}

  ngOnInit() {
    this.searchCssVariable();
  }
  writeValue(val?: string): void {
    this.value = val;
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
    this.onChange();
  }
  onChange() {
    this._onChange(this.value);
    this.valueChange.emit(this.value);
  }

  openCssVariableDialog(menuDialog: MenuDialog) {
    menuDialog.showModal();
  }

  /*---------------------CSS Variables----------------------------------*/
  searchCssVariable() {
    this.filteredCssVars = this.pb.cssVariables.filter(
      (x) => x.type == this.type() && x.name.toLowerCase().includes(this.filterCssVar.toLowerCase()),
    );
  }
  selectCssVar(item: ICssVariable, menuDialog: MenuDialog) {
    this.value = `var(--${item.name})`;
    this.onChange();
    menuDialog.closeModal();
  }
  async openCssVariablesDialog() {
    const { CssVariablesDialogComponent } =
      await import('../../lib/css-variables-dialog/css-variables-dialog.component');
    Dialog.open(CssVariablesDialogComponent).afterClosed.subscribe(() => this.searchCssVariable());
  }
}
