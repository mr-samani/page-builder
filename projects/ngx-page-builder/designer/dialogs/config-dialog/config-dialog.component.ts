import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { PageBuilderService } from '../../services/page-builder.service';
import { FormsModule } from '@angular/forms';
import { LibConsts, PageBuilderConfig, PageOrientation, PageSize } from 'ngx-page-builder/core';
import { NgxDialogModule, DIALOG_DATA, DIALOG_REF } from 'ngx-kit/dialog';
import { SegGroupComponent, type SegOption } from '../../controls/seg-group/seg-group.component';
import { InputCssComponent } from '../../controls/input-css/input-css.component';
import { CssUnitFieldComponent } from '../../controls/css-unit-field/css-unit-field.component';
import { NGX_PAGE_BUILDER_FONTS } from '../../controls/typography-control/fonts.token';
import { DEFAULT_FONTS, type FontOption } from '../../controls/typography-control/typography-model';

@Component({
  selector: 'app-config-dialog',
  templateUrl: './config-dialog.component.html',
  styleUrls: ['./config-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgxDialogModule, SegGroupComponent, InputCssComponent, CssUnitFieldComponent],
})
export class ConfigDialogComponent implements OnInit {
  protected readonly sizeUnits = ['px', 'em', 'rem', '%', 'vw', 'vh'] as const;
  private readonly projectFonts = inject(NGX_PAGE_BUILDER_FONTS, { optional: true }) ?? [];

  /** لیست کامل فونت‌ها: فونت‌های پروژه اول */
  protected readonly fonts: FontOption[] = [...this.projectFonts, ...DEFAULT_FONTS];
  protected readonly fontGroups = (() => {
    const map = new Map<string, FontOption[]>();
    for (const f of this.fonts) {
      if (!map.has(f.group)) map.set(f.group, []);
      map.get(f.group)!.push(f);
    }
    return Array.from(map, ([label, items]) => ({ label, items }));
  })();
  directionOptions: SegOption[] = [
    {
      label: 'Left to right',
      value: 'ltr',
    },
    {
      label: 'Right to left',
      value: 'rtl',
    },
  ];
  configs: PageBuilderConfig;
  sizeList: PageSize[] = ['A4', 'A5', 'Letter'];
  orientationList: PageOrientation[] = ['Portrait', 'Landscape'];
  viewMode = LibConsts.viewMode;
  private data = inject(DIALOG_DATA);
  private dialogRef = inject(DIALOG_REF);

  protected readonly pb = inject(PageBuilderService);

  constructor() {
    this.configs = Object.assign({}, this.pb.pageInfo.config);
  }

  ngOnInit() {}

  ok() {
    this.pb.pageInfo.config = this.configs;
    this.pb.updateChangeDetection({ item: null, type: 'ChangePageConfig' });
    this.dialogRef.close(this.configs);
  }
}
