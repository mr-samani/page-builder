import { ChangeDetectorRef, Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { PBPluginService } from '../../services/plugin/plugin.service';
import { Notify } from '../../extensions/notify';
import { LoadingComponent } from '../../controls/loading/loading.component';
import { SvgIconDirective } from '../../directives/svg-icon.directive';
import { CommonModule } from '@angular/common';
import { IPlugin, PageItem } from 'ngx-page-builder/core';

@Component({
  selector: 'app-plugins-dialog',
  templateUrl: './plugins-dialog.component.html',
  styleUrls: ['./plugins-dialog.component.scss'],
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    LoadingComponent,
    SvgIconDirective,
    CommonModule,
  ],
  providers: [PBPluginService],
})
export class PluginsDialogComponent implements OnInit {
  plugins: IPlugin[] = [];
  loading = true;
  search = '';

  take = 10;
  skip = 0;
  total = 0;

  pagination: number[] = [];
  selectedPage = 0;

  constructor(
    private dialogRef: MatDialogRef<PluginsDialogComponent>,
    private pluginService: PBPluginService,
    private chdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.getList();
  }

  getList() {
    this.loading = true;
    this.pluginService
      .getAllPlugins(this.take, this.skip, this.search)
      .finally(() => (this.loading = false))
      .then((p) => {
        this.plugins = p?.items ?? [];
        this.total = p?.total ?? 0;
        this.updatePagination();
        this.chdr.detectChanges();
      })
      .catch((error) => {
        Notify.error(error);
        this.dialogRef.close();
      });
  }

  filterList() {
    this.plugins = [];
    this.skip = 0;
    this.getList();
  }

  ok(plugin: IPlugin) {
    if (!plugin) return;
    this.pluginService.addToForm(plugin).catch((err) => Notify.error(err));
    this.dialogRef.close(true);
  }

  updatePagination() {
    const c = Math.ceil(this.total / this.take);
    this.pagination = [];
    for (let i = 0; i < c; i++) {
      this.pagination.push(i);
    }
  }
  changePage(p: number) {
    this.selectedPage = p;
    this.skip = p * this.take;
    this.getList();
  }
}
