import { Injectable } from '@angular/core';
import { DynamicDataStructure } from '../models/DynamicData';
import { PageItem } from '../models/PageItem';
import { IPage } from '../contracts/IPage';

@Injectable({
  providedIn: 'root',
})
export class DynamicDataService {
  private _dynamicData: DynamicDataStructure[] = [];

  private _valueDictionary: Record<string, string | undefined> = {};

  private map = new Map<string, DynamicDataStructure>();
  private nearestCache = new Map<string, string | null>(); // itemId -> nearest datasource id

  public set dynamicData(value: DynamicDataStructure[]) {
    this._dynamicData = value ?? [];
    this.createValueDictionary();
    console.log(this._dynamicData, this._valueDictionary);
  }
  public get dynamicData() {
    return this._dynamicData;
  }

  private createValueDictionary() {
    this._valueDictionary = {};
    if (!this._dynamicData) {
      return;
    }

    let recursiveTraverse = (list: DynamicDataStructure[], path: string[] = []) => {
      for (let obj of list) {
        if (obj.name) {
          let p = [...path, obj.name];
          let k = p.join('.');
          this._valueDictionary[k] = obj.value as any;
        }
        if (obj.values) {
          recursiveTraverse(obj.values, [...path, obj.name]);
        }
      }
    };

    for (let item of this._dynamicData) {
      let path: string[] = [item.name];
      if (item.values) {
        const values = item.values;
        recursiveTraverse(values, path);
      } else if (item.list) {
        for (let i = 0; i < item.list.length; i++) {
          let p = path[path.length - 1] + `[${i}]`;
          recursiveTraverse(item.list[i], [...path, p]);
        }
      }
    }
  }

  public replaceValues(pages: IPage[]) {
    setTimeout(() => {
      // console.log('Replacing values...', pages, this._valueDictionary);
      let replace = (item?: HTMLElement) => {
        if (!item) return;
        let txt = item.innerHTML;
        let isReplaced = false;
        for (const key in this._valueDictionary) {
          const value = this._valueDictionary[key] ?? '';
          const regEx = new RegExp(`\\[%${key}%\\]`, 'g');
          isReplaced = isReplaced || regEx.test(txt);
          txt = txt.replace(regEx, value);
        }
        if (isReplaced) {
          item.innerHTML = txt;
        }
      };
      for (let page of pages) {
        page.bodyItems.forEach((item) => replace(item.el));
        page.headerItems.forEach((item) => replace(item.el));
        page.footerItems.forEach((item) => replace(item.el));
      }
    }, 100);
  }

  /*------------------------------------------------------------------------------------------*/
  register(ds: DynamicDataStructure) {
    this.map.set(ds.id!, ds);
  }
  get(id: string) {
    return this.map.get(id) ?? null;
  }
  list() {
    return Array.from(this.map.values());
  }

  // walk up model parent pointers to find nearest datasource
  findNearestDataSource(itemId: string, pageModel: Map<string, PageItem>): string | null {
    if (this.nearestCache.has(itemId)) return this.nearestCache.get(itemId)!;
    let cur = pageModel.get(itemId);
    while (cur) {
      if (cur.dataSource?.id) {
        this.nearestCache.set(itemId, cur.dataSource.id);
        return cur.dataSource.id;
      }
      if (!cur.parent?.id) break;
      cur = pageModel.get(cur.parent.id);
    }
    this.nearestCache.set(itemId, null);
    return null;
  }

  // call this whenever tree structure or datasource references change
  invalidateNearestCacheFor(itemIds?: string[]) {
    if (!itemIds) this.nearestCache.clear();
    else itemIds.forEach((id) => this.nearestCache.delete(id));
  }

  /**
   * get collection data by datasource id
   * @TODO: must be can call api and cache data
   * @param id datasource id
   */
  getCollectionData(id: string | undefined, skip = 0, take?: number): DynamicDataStructure[][] {
    if (!id) return [];
    let list = (this.dynamicData.find((x: DynamicDataStructure) => x.id === id)?.list ?? []).slice(
      skip,
      take ? skip + take : undefined,
    );
    if (list.length === 0) {
      console.warn(`No collection data found for datasource id: ${id}`);
    }
    return list;
  }
}
