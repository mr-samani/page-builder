import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  Inject,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { CssClassesEditorComponent } from '../../components/css-classes-editor/css-classes-editor.component';
import { FileSelector } from '../../helper/FileSelector';
import { TabGroupModule } from '../../controls/tab-group/tab-group.module';
import { CommonModule } from '@angular/common';
import { Notify } from '../../extensions/notify';
import { ClassManagerService, ICssFile, LibConsts, cloneDeep } from 'ngx-page-builder/core';

@Component({
  selector: 'app-css-file-dialog',
  templateUrl: './css-file-dialog.component.html',
  styleUrls: ['./css-file-dialog.component.scss'],

  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    ReactiveFormsModule,
    CssClassesEditorComponent,
    TabGroupModule,
    FormsModule,
  ],
})
export class CssFileDialogComponent {
  loading = false;
  enableAddCssFile = LibConsts.enableAddCssFile;
  selectedTabIndex: number = 0;

  files: ICssFile[] = [];

  data = inject<{ classes?: Record<string, string> }>(MAT_DIALOG_DATA);
  constructor(
    public dialogRef: MatDialogRef<CssFileDialogComponent>,
    private cls: ClassManagerService,
    private chdRef: ChangeDetectorRef
  ) {
    this.files = cloneDeep(cls.cssFileData);
  }

  async addFile() {
    try {
      this.loading = true;
      const file = await FileSelector.selectFile({
        accept: ['text/css', '.css'],
      });
      const text = await file.text();
      await this.cls.addCssFile(file.name.split('.')[0], text, false);
      this.loading = false;
      this.chdRef.detectChanges();
    } catch (err) {
      console.log(err);
      this.loading = false;
    }
  }

  updateFile() {
    const selectedFile = this.files[this.selectedTabIndex];
    if (!selectedFile) {
      return;
    }
    this.loading = true;
    this.cls
      .updateCssFile(selectedFile.id, selectedFile.data, true)
      .then((result) => {
        Notify.success('Changed Successfully');
        this.dialogRef.close();
      })
      .catch((err) => {
        Notify.error(err);
      })
      .finally(() => (this.loading = false));
  }

  deleteFile() {
    const selectedFile = this.files[this.selectedTabIndex];
    if (!selectedFile) {
      return;
    }
    this.loading = true;
    this.cls
      .removeCssFile(selectedFile.id)
      .then((result) => {
        Notify.success('Changed Successfully');
        this.files.splice(this.selectedTabIndex, 1);
        if (this.selectedTabIndex > 0) {
          this.selectedTabIndex--;
        } else {
          this.selectedTabIndex = 0;
        }
      })
      .catch((err) => {
        Notify.error(err);
      })
      .finally(() => (this.loading = false));
  }
}
