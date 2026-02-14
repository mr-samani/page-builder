import { Component, inject, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { PageBuilderService } from '../../services/page-builder.service';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { PageBuilderConfig, PageOrientation, PageSize } from 'ngx-page-builder/core';

@Component({
  selector: 'app-config-dialog',
  templateUrl: './config-dialog.component.html',
  styleUrls: ['./config-dialog.component.scss'],
  imports: [FormsModule, MatDialogModule, MatButtonModule],
})
export class ConfigDialogComponent implements OnInit {
  configs: PageBuilderConfig;
  sizeList: PageSize[] = ['A4', 'A5', 'Letter'];
  orientationList: PageOrientation[] = ['Portrait', 'Landscape'];
  private data = inject(MAT_DIALOG_DATA);
  constructor(
    private dialogRef: MatDialogRef<ConfigDialogComponent>,
    private pageBuilder: PageBuilderService
  ) {
    this.configs = Object.assign({}, pageBuilder.pageInfo.config);
  }

  ngOnInit() {}

  ok() {
    this.pageBuilder.pageInfo.config = this.configs;
    this.pageBuilder.updateChangeDetection({ item: null, type: 'ChangePageConfig' });
    this.dialogRef.close(true);
  }
}
