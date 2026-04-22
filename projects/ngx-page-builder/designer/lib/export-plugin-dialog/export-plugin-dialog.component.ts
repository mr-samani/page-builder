import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PBPluginService } from '../../services/plugin/plugin.service';
import { Notify } from '../../extensions/notify';
import { LoadingComponent } from '../../controls/loading/loading.component';
import { PageBuilderService } from '../../services/page-builder.service';
import { IPlugin, PageItem } from 'ngx-page-builder/core';
import { DIALOG_DATA, DIALOG_REF, NgxDialogModule } from '../../extensions/dialog';

@Component({
  selector: 'app-export-plugin-dialog',
  templateUrl: './export-plugin-dialog.component.html',
  styleUrls: ['./export-plugin-dialog.component.scss'],
  imports: [FormsModule, NgxDialogModule, LoadingComponent],
  providers: [PBPluginService],
})
export class ExportPluginDialogComponent implements OnInit {
  name = '';
  img = '';

  plugin?: IPlugin;
  loading = true;
  private _data = inject<PageItem>(DIALOG_DATA);
  private dialogRef = inject(DIALOG_REF);

  constructor(
    private pluginService: PBPluginService,
    private chdr: ChangeDetectorRef,
    private pb: PageBuilderService,
  ) {
    this.loading = true;
  }

  ngOnInit() {
    this.getData();
  }

  getData() {
    const tmpShowOutlines = this.pb.showOutlines();
    this.pb.showOutlines.set(false);
    this.pluginService
      .getPlugin(this._data)
      .then((p) => {
        this.plugin = p;
        this.img = p.image;
        this.name = p.name;
        this.loading = false;
        this.pb.showOutlines.set(tmpShowOutlines);
        this.chdr.detectChanges();
      })
      .catch((error) => {
        Notify.error(error);
        this.pb.showOutlines.set(tmpShowOutlines);
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
