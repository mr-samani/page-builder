import { Injectable } from '@angular/core';
import { firstValueFrom, isObservable } from 'rxjs';
import { DynamicDataInput, DynamicDataStructure, DynamicValueType } from '../models/DynamicData';
import { DataSourceSetting } from '../models/DataSourceSetting';
import { PageItem } from '../models/PageItem';
import { IPage } from '../contracts/IPage';
import { applyFilters, applySorts } from '../utiles/data-schema';
import type { IPageItem } from '../../../../dist/ngx-page-builder/types/ngx-page-builder-core';

export interface CollectionQueryOptions {
  /**
   * designer only: when the data source returns no record, build sample records from the schema
   * so that the user can see (and style) what the bound elements will look like.
   */
  sampleWhenEmpty?: boolean;
  /** number of sample records (default: maxResultCount or 3) */
  sampleCount?: number;
}

export interface CollectionQueryResult<DTO = any> {
  rows: DTO[];
  /** structure of one record (always available when the source declares it, even if `rows` is empty) */
  schema: DynamicDataStructure[];
  /** true when `rows` were generated from the schema */
  isSample: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class DynamicDataService {
  private _dynamicData: DynamicDataStructure[] = [];

  // Cache DataRaw for replace value
  private rawCache = new Map<string, any>();
  private nearestCache = new Map<string, string | null>(); // itemId -> nearest datasource id
  private schemaCache = new Map<string, DynamicDataStructure[]>(); // schemas discovered from loaded data

  public set dynamicData(value: DynamicDataStructure[]) {
    this._dynamicData = value ?? [];
    this.schemaCache.clear();
  }

  public get dynamicData() {
    return this._dynamicData;
  }

  private async getDataRaw(block: IPageItem) {
    if (!block || !block.dataSource || !block.dataSource.id) return null;
    const value = this.rawCache.get(block.dataSource.id);
    if (value) {
      return value;
    } else {
      const data = await this.queryCollection(block.dataSource);
      this.rawCache.set(block.dataSource.id, data);
      return data;
    }
  }

  public replaceValues(pages: IPage[]) {
    setTimeout(() => {
      // console.log('Replacing values...', pages, this._valueDictionary);
      let replace = async (item: IPageItem) => {
        if (!item.el) return;
        const content = item.content?.trim() ?? '';
        if (content.startsWith('{{') && content.endsWith('}}')) {
          let raw = await this.getDataRaw(item);
          if (!raw) return;
          const paths = content.replace('{{', '').replace('}}', '').split('.');
          for (const p of paths) {
            raw = raw[p];
          }
          item.el.textContent = raw.toString();
        }
      };
      for (let page of pages) {
        page.bodyItems.forEach((item) => replace(item));
        page.headerItems.forEach((item) => replace(item));
        page.footerItems.forEach((item) => replace(item));
      }
    }, 100);
  }

  public replaceContentValue(content: string): string {
    if (!content) return '';
    let txt = content;

    let isReplaced = false;
    // TODO
    // for (const key in this._valueDictionary) {
    //   const value = this._valueDictionary[key] ?? '';
    //   const regEx = new RegExp(`\\{{${key}\\}}`, 'g');
    //   isReplaced = isReplaced || regEx.test(txt);
    //   txt = txt.replace(regEx, value);
    // }
    return txt;
  }
  /*------------------------------------------------------------------------------------------*/

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

  /** collection data source by id */
  findDataSource(id: string | undefined): DynamicDataStructure | undefined {
    return id ? this.dynamicData.find((x: DynamicDataStructure) => x.id === id) : undefined;
  }

  /**
   * Loads the records of a collection: applies skip / take / filters / sorts.
   * - `list` is a function (API): skip, take, params, filters and sorts are passed to it (server side paging).
   * - `list` is an array / observable: filters, sorts and paging are applied here.
   */
  async queryCollection(
    setting: Partial<DataSourceSetting> | undefined,
    options: CollectionQueryOptions = {},
  ): Promise<CollectionQueryResult> {
    const ds = this.findDataSource(setting?.id);
    if (!setting || !ds) return { rows: [], schema: [], isSample: false };

    const skip = setting.skipCount ?? 0;
    const take = setting.maxResultCount || undefined;
    const serverSide = typeof ds.rawData === 'function';

    let rows: any[] = [];
    try {
      rows =
        (await resolveList(ds, {
          skip,
          take,
          params: setting.params,
          filters: setting.filters,
          sorts: setting.sorts,
        })) ?? [];
    } catch (e) {
      console.warn(`Failed to load collection data of datasource '${setting.id}'`, e);
    }

    if (!serverSide) {
      rows = applySorts(applyFilters(rows, setting.filters), setting.sorts).slice(skip, take ? skip + take : undefined);
    }
    //TODO//
    const schema = {} as any; // declaredSchema(ds) ?? this.schemaCache.get(ds.id!) ?? (rows[0] ? schemaFromRow(rows[0]) : []);
    // if (schema.length && !this.schemaCache.has(ds.id!)) this.schemaCache.set(ds.id!, schema);

    // if (rows.length === 0 && options.sampleWhenEmpty && schema.length) {
    //   return { rows: buildSampleRows(schema, options.sampleCount ?? take ?? 3), schema, isSample: true };
    // }
    return { rows, schema, isSample: false };
  }
}

async function resolveList(item: DynamicDataStructure, input: DynamicDataInput = {}): Promise<unknown[]> {
  const request: DynamicDataInput = { ...input };
  // default values of the input parameters declared by the data source
  if (item.inputData && !request.params) {
    request.params = {};
    for (const k of item.inputData) {
      request.params[k.name] = k.value;
    }
  }
  const listField = item.rawData;
  if (!listField) return [];

  // list is a function (promise / observable / plain array)
  if (typeof listField === 'function') {
    const result = listField(request);
    if (isObservable(result)) {
      return await firstValueFrom(result);
    }
    return await result;
  }

  if (isObservable(listField)) {
    return await firstValueFrom(listField as any);
  }

  return listField;
}
