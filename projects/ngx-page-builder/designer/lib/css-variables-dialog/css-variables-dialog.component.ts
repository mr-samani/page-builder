import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TabGroupModule } from '../../controls/tab-group/tab-group.module';
import { CommonModule } from '@angular/common';
import { LibConsts } from 'ngx-page-builder/core';
import { ClassManagerService } from '../../services/class-manager.service';
import { NgxInputColor } from 'ngx-input-color/color-picker';
import { SvgIconDirective } from '../../directives/svg-icon.directive';
import { DIALOG_REF, NgxDialogModule } from '../../extensions/dialog';
import { PageBuilderService } from '../../services/page-builder.service';
@Component({
  selector: 'app-css-variables-dialog',
  templateUrl: './css-variables-dialog.component.html',
  styleUrls: ['./css-variables-dialog.component.scss'],

  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    NgxDialogModule,
    ReactiveFormsModule,
    TabGroupModule,
    FormsModule,
    NgxInputColor,
    SvgIconDirective,
  ],
})
export class CssVariablesDialogComponent implements OnInit {
  loading = false;
  enableAddCssFile = LibConsts.enableAddCssFile;

  private dialogRef = inject(DIALOG_REF);

  constructor(
    private cls: ClassManagerService,
    public pb: PageBuilderService,
    private chdRef: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    if (!this.pb.cssVariables.length) {
      this.add();
    }
  }
  remove(index: number) {
    this.pb.cssVariables.splice(index, 1);
  }

  add() {
    this.pb.cssVariables.push({
      type: 'String',
      name: '',
      value: '',
    });
  }
}
