import { Injectable } from '@angular/core';
import { DynamicDataInput, DynamicDataStructure } from '../models/DynamicData';
import { PageItem } from '../models/PageItem';
import { IPage } from '../contracts/IPage';
import { Observable, switchMap } from 'rxjs';

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
    this.createValueDictionary().then(() => {
      console.log(this._dynamicData, this._valueDictionary);
    });
  }

  public get dynamicData() {
    return this._dynamicData;
  }

  private async createValueDictionary() {
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
          const list = await resolveList(item);
          recursiveTraverse(list[i], [...path, p]);
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
          const regEx = new RegExp(`\\{{${key}\\}}`, 'g');
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

  public replaceContentValue(content: string): string {
    if (!content) return '';
    let txt = content;

    let isReplaced = false;
    for (const key in this._valueDictionary) {
      const value = this._valueDictionary[key] ?? '';
      const regEx = new RegExp(`\\{{${key}\\}}`, 'g');
      isReplaced = isReplaced || regEx.test(txt);
      txt = txt.replace(regEx, value);
    }
    return txt;
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
   * @param id datasource id
   */
  async getCollectionData(
    id: string | undefined,
    skip = 0,
    take?: number,
    params?: { [key: string]: any },
  ): Promise<DynamicDataStructure[][]> {
    if (!id) return [];
    let result: DynamicDataStructure[][] = [];
    const finded = this.dynamicData.find((x: DynamicDataStructure) => x.id === id);
    if (finded) {
      const list = await resolveList(finded, take, skip, params);
      result = list.slice(skip, take ? skip + take : undefined);
    }
    if (result.length === 0) {
      console.warn(`No collection data found for datasource id: ${id}`);
    }
    return result;
  }
}

import { isObservable, firstValueFrom } from 'rxjs';

async function resolveList(
  item: DynamicDataStructure,
  take?: number,
  skip?: number,
  params?: { [key: string]: any },
): Promise<DynamicDataStructure[][]> {
  if (!item?.list) return [];
  const input: DynamicDataInput = {
    take,
    skip,
    params,
  };
  if (item.inputData && !params) {
    input.params ??= {};
    for (let k of item.inputData) {
      input.params[k.name] = k.value;
    }
  }
  const listField = item.list;

  // اگر list یک تابع است -> صدا بزنیم
  if (typeof listField === 'function') {
    const result = listField(input);

    // تشخیص Promise با بررسی then
    if (result && typeof (result as Promise<any>)?.then === 'function') {
      return (await result) as any;
    }

    // تشخیص Observable
    if (isObservable(result)) {
      // منتظر اولین مقدار شو (یا استفاده از lastValueFrom بنا به نیاز)
      return await firstValueFrom<DynamicDataStructure[][]>(result as any);
    }

    // اگر تابع مستقیم آرایه برگشت داده
    return result as any;
  }

  // اگر list خودش مستقیم آرایه است
  if (isObservable(listField)) {
    return await firstValueFrom<DynamicDataStructure[][]>(listField as any);
  }

  return listField as DynamicDataStructure[][];
}
