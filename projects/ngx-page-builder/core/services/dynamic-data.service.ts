import { Injectable } from '@angular/core';
import { firstValueFrom, isObservable } from 'rxjs';
import { DynamicDataInput, DynamicDataStructure } from '../models/DynamicData';
import { DataSourceSetting } from '../models/DataSourceSetting';
import { PageItem } from '../models/PageItem';
import { IPage } from '../contracts/IPage';
import {
  applyFilters,
  applySorts,
  buildSampleRows,
  DataRow,
  declaredSchema,
  schemaFromRow,
} from '../utiles/data-schema';

export interface CollectionQueryOptions {
  /**
   * designer only: when the data source returns no record, build sample records from the schema
   * so that the user can see (and style) what the bound elements will look like.
   */
  sampleWhenEmpty?: boolean;
  /** number of sample records (default: maxResultCount or 3) */
  sampleCount?: number;
}

export interface CollectionQueryResult {
  rows: DataRow[];
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

  private _valueDictionary: Record<string, string | undefined> = {};

  private map = new Map<string, DynamicDataStructure>();
  private nearestCache = new Map<string, string | null>(); // itemId -> nearest datasource id
  private schemaCache = new Map<string, DynamicDataStructure[]>(); // schemas discovered from loaded data

  public set dynamicData(value: DynamicDataStructure[]) {
    this._dynamicData = value ?? [];
    this.schemaCache.clear();
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
      let replace = (item?: HTMLElement | null) => {
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

  /** collection data source by id */
  findDataSource(id: string | undefined): DynamicDataStructure | undefined {
    return id ? this.dynamicData.find((x: DynamicDataStructure) => x.id === id) : undefined;
  }

  /**
   * STRUCTURE of the records of a collection, without loading data.
   * Works when the source declares `fields` / `values` or has a static `list`.
   */
  getSchema(id: string | undefined): DynamicDataStructure[] {
    const ds = this.findDataSource(id);
    if (!ds) return [];
    return declaredSchema(ds) ?? this.schemaCache.get(ds.id!) ?? [];
  }

  /**
   * Same as getSchema but, when the source does not declare its structure (list is an API call),
   * loads ONE record and infers the structure from it.
   */
  async resolveSchema(id: string | undefined): Promise<DynamicDataStructure[]> {
    const known = this.getSchema(id);
    if (known.length || !id) return known;
    const { schema } = await this.queryCollection({ id, maxResultCount: 1 });
    if (schema.length) this.schemaCache.set(id, schema);
    return schema;
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
    const serverSide = typeof ds.list === 'function';

    let rows: DataRow[] = [];
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

    const schema = declaredSchema(ds) ?? this.schemaCache.get(ds.id!) ?? (rows[0] ? schemaFromRow(rows[0]) : []);
    if (schema.length && !this.schemaCache.has(ds.id!)) this.schemaCache.set(ds.id!, schema);

    if (rows.length === 0 && options.sampleWhenEmpty && schema.length) {
      return { rows: buildSampleRows(schema, options.sampleCount ?? take ?? 3), schema, isSample: true };
    }
    return { rows, schema, isSample: false };
  }

  /**
   * get collection data by datasource id
   * @deprecated use queryCollection (supports filters, sorts and sample data)
   */
  async getCollectionData(
    id: string | undefined,
    skip = 0,
    take?: number,
    params?: { [key: string]: any },
  ): Promise<DynamicDataStructure[][]> {
    const { rows } = await this.queryCollection({ id, skipCount: skip, maxResultCount: take, params });
    return rows;
  }
}

async function resolveList(item: DynamicDataStructure, input: DynamicDataInput = {}): Promise<DynamicDataStructure[][]> {
  const request: DynamicDataInput = { ...input };
  // default values of the input parameters declared by the data source
  if (item.inputData && !request.params) {
    request.params = {};
    for (const k of item.inputData) {
      request.params[k.name] = k.value;
    }
  }
  const listField = item.list;
  if (!listField) return [];

  // list is a function (promise / observable / plain array)
  if (typeof listField === 'function') {
    const result = listField(request);
    if (isObservable(result)) {
      return await firstValueFrom<DynamicDataStructure[][]>(result as any);
    }
    return (await result) as DynamicDataStructure[][];
  }

  if (isObservable(listField)) {
    return await firstValueFrom<DynamicDataStructure[][]>(listField as any);
  }

  return listField as DynamicDataStructure[][];
}
