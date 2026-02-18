import { IPaginationPlugin, IPlugin } from 'ngx-page-builder/core';

export interface IPluginStore {
  save(plugin: IPlugin): void;
  getAllPlugins(take: number, skip: number, filter: string): Promise<IPaginationPlugin>;
}

export class PluginStore {
  private _plugins: IPlugin[] = [];

  save(plugin: IPlugin) {
    console.log(plugin);
  }

  getAllPlugins(take: number, skip: number, filter: string): Promise<IPaginationPlugin> {
    return new Promise<IPaginationPlugin>((resolve, reject) => {
      const result = this._plugins.filter((x: IPlugin) => x.name.includes(filter));
      const list = result.slice(skip, skip + take);
      resolve({
        items: list,
        total: result.length,
      });
    });
  }
}
