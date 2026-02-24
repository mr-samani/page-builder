import { CommonModule } from '@angular/common';
import { Component, effect, Injector, OnInit, Type, ViewChild } from '@angular/core';
import { BaseComponent } from '../BaseComponent';
import { TextBindingComponent } from '../text-binding/text-binding.component';
import { MatDialog } from '@angular/material/dialog';
import { DynamicDataService, DynamicDataStructure, LibConsts, PageItem } from 'ngx-page-builder/core';
import { EditLinkComponent } from '../edit-link/edit-link.component';

@Component({
  selector: 'block-settings',
  templateUrl: './block-settings.component.html',
  styleUrls: ['./block-settings.component.scss'],
  standalone: true,
  imports: [CommonModule, TextBindingComponent, EditLinkComponent],
})
export class BlockSettingsComponent extends BaseComponent implements OnInit {
  item?: PageItem;
  settingComponent?: Type<any>;
  @ViewChild('settingsContainer', { static: true }) settingsContainer!: HTMLElement;

  parentCollection?: PageItem;
  collectionDsList: DynamicDataStructure[] = [];

  enableExportAsPlugin = LibConsts.enableExportAsPlugin;
  constructor(
    private injector: Injector,
    private dynamicDataService: DynamicDataService,
    private dialog: MatDialog,
  ) {
    super(injector);
    effect(async () => {
      this.item = this.pageBuilder.activeEl();
      this.checkParentIsCollection();

      if (this.item && this.item.customComponent && typeof this.item.customComponent.componentSettings === 'function') {
        this.settingComponent = await this.item.customComponent.componentSettings();
      } else {
        this.settingComponent = undefined;
      }
      this.chdRef.detectChanges();
    });
  }

  ngOnInit() {}
  onChangeProperties() {
    if (this.item) this.pageBuilder.changedProperties(this.item);
  }
  async checkParentIsCollection() {
    this.parentCollection = this.parentCollectionItem(this.item);
    if (this.parentCollection) {
      const { id, skipCount, maxResultCount, params } = this.parentCollection.dataSource!;
      let dsList = await this.dynamicDataService.getCollectionData(id, skipCount, maxResultCount, params);
      this.collectionDsList = dsList.length > 0 ? dsList[0] : [];
    }
  }

  parentCollectionItem(item?: PageItem): PageItem | undefined {
    if (!item) return undefined;
    if (item.dataSource?.id) {
      // if (item.template || item.customComponent?.componentKey == 'NgxPgHeroTable') {
      return item;
    }
    if (item.parent) {
      return this.parentCollectionItem(item.parent);
    }
    return undefined;
  }

  async exportBlockAsPlugin() {
    if (!this.item) return;
    const { ExportPluginDialogComponent } =
      await import('../../lib/export-plugin-dialog/export-plugin-dialog.component');
    this.dialog.open(ExportPluginDialogComponent, {
      data: this.item,
      width: '80%',
      injector: this.injector,
    });
  }
}
