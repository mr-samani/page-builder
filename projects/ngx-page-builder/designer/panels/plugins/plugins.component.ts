import { ChangeDetectorRef, Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PBPluginService } from '../../services/plugin/plugin.service';
import { LoadingComponent } from '../../controls/loading/loading.component';
import { NgxIconComponent } from 'ngx-page-builder/icons';
import { CommonModule } from '@angular/common';
import { IPlugin, LibConsts } from 'ngx-page-builder/core';
import { Notify } from 'ngx-kit/notify';
import { PbPanel } from '../panel.layout';

@Component({
  selector: 'app-plugins',
  templateUrl: './plugins.component.html',
  styleUrls: ['./plugins.component.scss'],
  imports: [FormsModule, LoadingComponent, NgxIconComponent, CommonModule, PbPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PBPluginService],
})
export class PluginsComponent implements OnInit {
  plugins: IPlugin[] = [];
  loading = true;
  search = '';

  take = 10;
  skip = 0;
  total = 0;

  pagination: number[] = [];
  selectedPage = 0;

  canDeletePlugin = LibConsts.canDeletePlugin;
  constructor(
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
  deleteItem(item: IPlugin, index: number) {
    item.loading = true;
    this.pluginService
      .deletePlugin(item, this.skip + index)
      .finally(() => (item.loading = false))
      .then((p) => {
        if (p) {
          this.plugins.splice(index, 1);
        }
        this.updatePagination();
        this.chdr.detectChanges();
      })
      .catch((error) => {
        Notify.error(error);
      });
  }
}
