import { Component, inject, OnInit } from '@angular/core';
import { PageBuilderService } from '../../services/page-builder.service';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { PageBuilderConfig, PageOrientation, PageSize } from 'ngx-page-builder/core';
import { DIALOG_DATA, NgxDialogModule, NgxDialogRef } from '../../extensions/dialog';

@Component({
  selector: 'app-config-dialog',
  templateUrl: './config-dialog.component.html',
  styleUrls: ['./config-dialog.component.scss'],
  imports: [FormsModule, NgxDialogModule, MatButtonModule],
})
export class ConfigDialogComponent implements OnInit {
  configs: PageBuilderConfig;
  sizeList: PageSize[] = ['A4', 'A5', 'Letter'];
  orientationList: PageOrientation[] = ['Portrait', 'Landscape'];
  private data = inject(DIALOG_DATA);
  constructor(
    private dialogRef: NgxDialogRef,
    private pb: PageBuilderService,
  ) {
    this.configs = Object.assign({}, pb.pageInfo.config);
  }

  ngOnInit() {}

  ok() {
    this.pb.pageInfo.config = this.configs;
    this.pb.updateChangeDetection({ item: null, type: 'ChangePageConfig' });
    this.dialogRef.close(true);
  }
}
