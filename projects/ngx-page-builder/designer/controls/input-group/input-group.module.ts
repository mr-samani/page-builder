import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InputGroupComponent } from './input-group.component';
import { FormsModule } from '@angular/forms';
import { InputOptionComponent } from './input-option.component';

@NgModule({
  imports: [CommonModule, FormsModule],
  declarations: [InputGroupComponent, InputOptionComponent],
  exports: [InputGroupComponent, InputOptionComponent],
})
export class InputGroupModule {}
