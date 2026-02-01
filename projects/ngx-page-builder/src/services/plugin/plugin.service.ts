import { Inject, Injectable } from '@angular/core';
import { PageItem } from '../../models/PageItem';
import { deepCloneInstance } from '../../utiles/clone-deep';
import {
  IPageItem,
  IPluginStore,
  NGX_PAGE_BUILDER_EXPORT_PLUGIN_STORE,
  PageBuilderService,
  preparePageItems,
} from '../../public-api';
import { sanitizeForStorage } from '../storage/sanitizeForStorage';
import { ClassManagerService } from '../class-manager.service';
import { IPaginationPlugin, IPlugin } from '../../contracts/IPlugin';

@Injectable()
export class PBPluginService {
  constructor(
    private cls: ClassManagerService,
    private pageBuilder: PageBuilderService,
    @Inject(NGX_PAGE_BUILDER_EXPORT_PLUGIN_STORE) private pluginStore: IPluginStore,
  ) {}
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
          this.cls.importPluginCss(plugin.name, parsed.style);
        }
      } catch (error) {
        reject(error);
      }
    });
  }
}
