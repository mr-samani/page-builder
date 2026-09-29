import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { NXG_PAGE_BUILDER_SERVICE } from '../../services/page-builder.service';
import { FormsModule } from '@angular/forms';
import { PageBuilderConfig, PageOrientation, PageSize } from 'ngx-page-builder/core';
import { NgxDialogModule, DIALOG_DATA, DIALOG_REF } from 'ngx-kit/dialog';

@Component({
  selector: 'app-config-dialog',
  templateUrl: './config-dialog.component.html',
  styleUrls: ['./config-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgxDialogModule],
})
export class ConfigDialogComponent implements OnInit {
  configs: PageBuilderConfig;
  sizeList: PageSize[] = ['A4', 'A5', 'Letter'];
  orientationList: PageOrientation[] = ['Portrait', 'Landscape'];
  private data = inject(DIALOG_DATA);
  private dialogRef = inject(DIALOG_REF);

  protected readonly pb = inject(NXG_PAGE_BUILDER_SERVICE);

  constructor() {
    this.configs = Object.assign({}, this.pb.pageInfo.config);
  }

  ngOnInit() {}

  ok() {
    this.pb.pageInfo.config = this.configs;
    this.pb.updateChangeDetection({ item: null, type: 'ChangePageConfig' });
    this.dialogRef.close(true);
  }
}
