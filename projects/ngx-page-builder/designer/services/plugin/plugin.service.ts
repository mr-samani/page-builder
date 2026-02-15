import { inject, Inject, Injectable } from '@angular/core';
import { sanitizeForStorage } from '../storage/sanitizeForStorage';

import { PageBuilderService } from '../page-builder.service';
import { NGX_PAGE_BUILDER_EXPORT_PLUGIN_STORE } from './plugin.token';
import { IPluginStore } from './plugin.store';
import { preparePageItems } from '../storage/prepare-page-builder-data';

import {
  IPageItem,
  IPaginationPlugin,
  IPlugin,
  PageItem,
  deepCloneInstance,
} from 'ngx-page-builder/core';
import { ClassManagerService } from '../class-manager.service';

@Injectable()
export class PBPluginService {
  private pluginStore = inject<IPluginStore>(NGX_PAGE_BUILDER_EXPORT_PLUGIN_STORE);
  constructor(private cls: ClassManagerService, private pageBuilder: PageBuilderService) {}
  async getPlugin(item: PageItem): Promise<IPlugin> {
    return new Promise<IPlugin>(async (resolve, reject) => {
      try {
        const { snapdom } = await import('@zumer/snapdom');
        if (!snapdom) {
          throw new Error('snapdom not exist. `npm i @zumer/snapdom`');
        }

        if (!item.el) {
          throw new Error('Can not get html element!');
        }

        const style = this.cls.getBlockStyles(item);

        const img =
          (
            await snapdom.toPng(item.el, {
              embedFonts: true,
              backgroundColor: '#fff',
              outerShadows: true,
              fast: false,
              placeholders: true,
            })
          ).src ?? '';
        const clonedData = deepCloneInstance(item);
        const data = preparePageItems([clonedData])[0];
        const sanitized = sanitizeForStorage(data);

        resolve({
          image: img,
          name: '',
          plugin: JSON.stringify({ sanitized, style }),
        });
      } catch (error: any) {
        reject(error);
      }
    });
  }
  save(plugin: IPlugin) {
    this.pluginStore.save(plugin);
  }

  getAllPlugins(take: number, skip: number, filter: string): Promise<IPaginationPlugin> {
    return this.pluginStore.getAllPlugins(take, skip, filter);
  }
  addToForm(plugin: IPlugin) {
    return new Promise((resolve, reject) => {
      try {
        const parsed: { sanitized: IPageItem; style: string } = JSON.parse(plugin.plugin);

        this.pageBuilder.addBlockToCurrentPage(parsed.sanitized);
        if (parsed.style) {
          this.cls.addToDefaultStyles(parsed.style);
        }
      } catch (error) {
        reject(error);
      }
    });
  }
}
