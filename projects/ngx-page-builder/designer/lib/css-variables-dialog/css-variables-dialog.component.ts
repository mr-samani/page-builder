import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { TabGroupModule } from '../../controls/tab-group/tab-group.module';
import { CommonModule } from '@angular/common';
import { LibConsts } from 'ngx-page-builder/core';
import { ClassManagerService } from '../../services/class-manager.service';
import { NgxInputColor } from 'ngx-input-color/color-picker';
import { SvgIconDirective } from '../../directives/svg-icon.directive';
import { NgxDialogModule, NgxDialogRef } from '../../extensions/dialog';

@Component({
  selector: 'app-css-variables-dialog',
  templateUrl: './css-variables-dialog.component.html',
  styleUrls: ['./css-variables-dialog.component.scss'],

  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    NgxDialogModule,
    MatButtonModule,
    ReactiveFormsModule,
    TabGroupModule,
    FormsModule,
    NgxInputColor,
    SvgIconDirective,
  ],
})
export class CssVariablesDialogComponent {
  loading = false;
  enableAddCssFile = LibConsts.enableAddCssFile;

  variables: CssVariable[] = [];

  constructor(
    public dialogRef: NgxDialogRef,
    private cls: ClassManagerService,
    private chdRef: ChangeDetectorRef,
  ) {}

  remove(index: number) {
    this.variables.splice(index, 1);
  }

  add() {
    this.variables.push(new CssVariable());
  }
}

export class CssVariable {
  type: 'Color' | 'String' = 'String';
  name!: string;
  value!: string;
}
