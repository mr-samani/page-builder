import { ChangeDetectorRef, Component, inject, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { PBPluginService } from '../../services/plugin/plugin.service';
import { Notify } from '../../extensions/notify';
import { LoadingComponent } from '../../controls/loading/loading.component';
import { PageBuilderService } from '../../services/page-builder.service';
import { IPlugin, PageItem } from 'ngx-page-builder/core';

@Component({
  selector: 'app-export-plugin-dialog',
  templateUrl: './export-plugin-dialog.component.html',
  styleUrls: ['./export-plugin-dialog.component.scss'],
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, LoadingComponent],
  providers: [PBPluginService],
})
export class ExportPluginDialogComponent implements OnInit {
  name = '';
  img = '';

  plugin?: IPlugin;
  loading = true;
  private _data = inject<PageItem>(MAT_DIALOG_DATA);
  constructor(
    private dialogRef: MatDialogRef<ExportPluginDialogComponent>,
    private pluginService: PBPluginService,
    private chdr: ChangeDetectorRef,
    private pageBuilder: PageBuilderService,
  ) {
    this.loading = true;
  }

  ngOnInit() {
    this.getData();
  }

  getData() {
    const tmpShowOutlines = this.pageBuilder.showOutlines();
    this.pageBuilder.showOutlines.set(false);
    this.pluginService
      .getPlugin(this._data)
      .then((p) => {
        this.plugin = p;
        this.img = p.image;
        this.name = p.name;
        this.loading = false;
        this.pageBuilder.showOutlines.set(tmpShowOutlines);
        this.chdr.detectChanges();
      })
      .catch((error) => {
        Notify.error(error);
        this.pageBuilder.showOutlines.set(tmpShowOutlines);
        this.dialogRef.close();
      });
  }

  ok(ev?: Event) {
    if (ev) {
      ev.stopPropagation();
      ev.preventDefault();
    }
    if (!this.plugin || !this.name) return;
    this.plugin.name = this.name;
    this.pluginService.save(this.plugin);
    this.dialogRef.close(true);
  }
}
