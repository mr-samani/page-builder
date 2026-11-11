import { CommonModule } from '@angular/common';
import { Component, effect, Injector, OnInit, Type, ViewChild, ChangeDetectionStrategy, inject } from '@angular/core';
import { BaseComponent } from '../BaseComponent';
import { TextBindingComponent } from '../text-binding/text-binding.component';
import { DynamicDataService, DynamicDataStructure, LibConsts, PageItem } from 'ngx-page-builder/core';
import type { SourceSettingField } from 'ngx-page-builder/core';
import { EditLinkComponent } from '../edit-link/edit-link.component';
import { NgxDialogService } from 'ngx-kit/dialog';
import { GenericBlockSettingsComponent } from '../generic-block-settings/generic-block-settings.component';

@Component({
  selector: 'block-settings',
  templateUrl: './block-settings.component.html',
  styleUrls: ['./block-settings.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TextBindingComponent, EditLinkComponent, GenericBlockSettingsComponent],
})
export class BlockSettingsComponent extends BaseComponent implements OnInit {
  item?: PageItem;
  settingComponent?: Type<any>;
  sourceSettings: SourceSettingField[] = [];
  @ViewChild('settingsContainer', { static: true }) settingsContainer!: HTMLElement;

  parentCollection?: PageItem;
  /** structure of the records of the parent collection (known even if the collection is empty) */
  collectionFields: DynamicDataStructure[] = [];

  enableExportAsPlugin = LibConsts.enableExportAsPlugin;

  protected readonly injector = inject(Injector);
  protected readonly dialog = inject(NgxDialogService);
  protected readonly dynamicDataService = inject(DynamicDataService);

  constructor() {
    super();
    effect(async () => {
      this.item = this.pb.activeEl();
      await this.checkParentIsCollection();

      if (this.item && this.item.customComponent && typeof this.item.customComponent.componentSettings === 'function') {
        this.settingComponent = await this.item.customComponent.componentSettings();
        this.sourceSettings = [];
      } else {
        this.settingComponent = undefined;
        this.sourceSettings = this.resolveSourceSettings(this.item);
      }
      this.chdRef.detectChanges();
    });
  }

  private resolveSourceSettings(item?: PageItem): SourceSettingField[] {
    if (!item) return [];
    const source = this.pb.sources.find((candidate) => {
      if (!candidate.settings?.length) return false;
      if (item.sourceId && candidate.sourceId) return candidate.sourceId === item.sourceId;
      if (candidate.tag !== item.tag) return false;
      if (candidate.customComponent?.componentKey || item.customComponent?.componentKey) {
        return candidate.customComponent?.componentKey === item.customComponent?.componentKey;
      }
      return true;
    });
    return source?.settings ?? [];
  }

  ngOnInit() {}
  onChangeProperties() {
    if (this.item) this.pb.changedProperties(this.item);
  }
  async checkParentIsCollection() {
    const current = this.item;
    this.parentCollection = this.parentCollectionItem(current);
    this.collectionFields = [];
    if (this.parentCollection) {
      // another element may have been selected while the schema was loading
      if (this.item === current) this.collectionFields = [];
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
      await import('../../dialogs/export-plugin-dialog/export-plugin-dialog.component');
    this.dialog.open(ExportPluginDialogComponent, {
      data: this.item,
      size: 'md',
      header: {
        showMaximizeButton: true,
        showCloseButton: true,
      },
      panelClass: 'ngx-page-builder',
      injector: this.injector,
    });
  }
}
