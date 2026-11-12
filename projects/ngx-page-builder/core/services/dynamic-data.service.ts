import { Injectable } from '@angular/core';
import { firstValueFrom, isObservable } from 'rxjs';
import { DynamicDataInput, DynamicDataStructure, DynamicValueType } from '../models/DynamicData';
import { DataSourceSetting } from '../models/DataSourceSetting';
import { IPage } from '../contracts/IPage';
import { IPageItem } from '../contracts/IPageItem';
import { applyFilters, applySorts, buildSampleRows, schemaFromRow } from '../utiles/data-schema';
import {
  collectBindingPaths,
  getByPath,
  hasBindingToken,
  interpolateBindings,
  toDisplayText,
  toImageSrc,
} from '../utiles/data-binding';

export interface CollectionQueryOptions {
  /**
   * DESIGNER mode. The designer works with the structure of the data, not with data:
   * - `rawData` functions (API / Promise / Observable) are never called (no needless server requests)
   * - a static `rawData` list is used when given, otherwise sample records are built from the structure
   */
  sampleWhenEmpty?: boolean;
  /** number of sample records (default: `maxResultCount`, at most 3) */
  sampleCount?: number;
}

export interface CollectionQueryResult<DTO = any> {
  rows: DTO[];
  /** structure of one record (always available when the source declares it, even if `rows` is empty) */
  schema: DynamicDataStructure[];
  /** true when `rows` were generated from the structure */
  isSample: boolean;
}

/** `DOM NodeFilter.SHOW_TEXT` (the global `NodeFilter` does not exist on the server) */
const SHOW_TEXT = 4;

@Injectable({
  providedIn: 'root',
})
export class DynamicDataService {
  private _dynamicData: DynamicDataStructure[] = [];

  public set dynamicData(value: DynamicDataStructure[]) {
    this._dynamicData = value ?? [];
  }

  public get dynamicData() {
    return this._dynamicData;
  }

  /** collections (lists): blocks inside them are bound to the fields of a record */
  public get collectionSources(): DynamicDataStructure[] {
    return this._dynamicData.filter((x) => x.type === DynamicValueType.Array);
  }

  /** everything that is not a list: any block can be bound to a field of them */
  public get objectSources(): DynamicDataStructure[] {
    return this._dynamicData.filter((x) => x.type !== DynamicValueType.Array);
  }

  /** collection data source by id */
  findDataSource(id: string | undefined): DynamicDataStructure | undefined {
    return id ? this._dynamicData.find((x) => x.id === id) : undefined;
  }

  /** object data source by namespace (`personalInfo` of `personalInfo.job.title`) */
  findDataSourceByName(name: string | undefined): DynamicDataStructure | undefined {
    return name ? this._dynamicData.find((x) => x.name === name) : undefined;
  }

  /**
   * Structure of one record of a source: the declared `fields`, or inferred from the first record of a static list.
   * Never loads data from a server.
   */
  getSchema(id: string | undefined): DynamicDataStructure[] {
    const source = this.findDataSource(id);
    return source ? declaredSchema(source) : [];
  }

  /* ------------------------------------------------------------------------------------------ */
  /* collections (designer + viewer)                                                            */
  /* ------------------------------------------------------------------------------------------ */

  /**
   * Loads the records of a collection: applies skip / take / filters / sorts.
   * - `rawData` is a function (API): skip, take, params, filters and sorts are passed to it (server side paging).
   * - `rawData` is an array: filters, sorts and paging are applied here.
   * See {@link CollectionQueryOptions} for the designer mode.
   */
  async queryCollection(
    setting: Partial<DataSourceSetting> | undefined,
    options: CollectionQueryOptions = {},
  ): Promise<CollectionQueryResult> {
    const source = this.findDataSource(setting?.id);
    if (!setting || !source) return { rows: [], schema: [], isSample: false };

    const skip = setting.skipCount ?? 0;
    const take = setting.maxResultCount || undefined;
    const designer = !!options.sampleWhenEmpty;
    const canLoad = !designer || isStaticData(source.rawData);
    const serverSide = canLoad && typeof source.rawData === 'function';

    let rows: any[] = [];
    if (canLoad) {
      try {
        const raw = await loadRawData(source, {
          skip,
          take,
          params: setting.params,
          filters: setting.filters,
          sorts: setting.sorts,
        });
        rows = Array.isArray(raw) ? raw : [];
      } catch (e) {
        console.warn(`Failed to load collection data of datasource '${setting.id}'`, e);
      }
    }

    if (!serverSide) {
      rows = applySorts(applyFilters(rows, setting.filters), setting.sorts).slice(skip, take ? skip + take : undefined);
    }

    const schema = declaredSchema(source, rows[0]);
    if (designer && rows.length === 0 && schema.length) {
      const count = options.sampleCount ?? Math.min(take ?? 3, 3);
      return { rows: buildSampleRows(schema, count), schema, isSample: true };
    }
    return { rows, schema, isSample: false };
  }

  /* ------------------------------------------------------------------------------------------ */
  /* objects (viewer)                                                                           */
  /* ------------------------------------------------------------------------------------------ */

  /**
   * Fills the blocks that are bound to object data sources with the `rawData` of those sources:
   * - a block with `dataSource.binding` (`personalInfo.job.title`) shows the value of that field
   * - other text with `{{path}}` tokens (written in the text editor) gets the values of the tokens
   * Blocks inside collections / tables are skipped: those components fill their own children.
   */
  async replaceValues(pages: IPage[]): Promise<void> {
    const objects = new Map<string, Promise<unknown>>();
    const loadObject = (name: string) => {
      let data = objects.get(name);
      if (!data) {
        const source = this.findDataSourceByName(name);
        data = source
          ? loadRawData(source).catch((e) => {
              console.warn(`Failed to load data of datasource '${name}'`, e);
              return undefined;
            })
          : Promise.resolve(undefined);
        objects.set(name, data);
      }
      return data;
    };

    for (const page of pages) {
      for (const item of [...page.headerItems, ...page.bodyItems, ...page.footerItems]) {
        await this.bindTree(item, loadObject);
      }
    }
  }

  private async bindTree(item: IPageItem, loadObject: ObjectLoader) {
    if (item.dataSource?.id) return;
    await this.bindItem(item, loadObject);
    for (const child of item.children ?? []) {
      await this.bindTree(child, loadObject);
    }
  }

  private async bindItem(item: IPageItem, loadObject: ObjectLoader) {
    const el = item.el;
    if (!el) return;

    const binding = item.dataSource?.binding;
    if (binding) {
      const value = await valueOfObjectPath(binding, loadObject);
      if (el.tagName === 'IMG') {
        const src = toImageSrc(value);
        if (src) el.setAttribute('src', src);
      } else {
        el.textContent = toDisplayText(value);
      }
      return;
    }

    if (!hasBindingToken(item.content)) return;
    const values = new Map<string, unknown>();
    for (const path of collectBindingPaths(item.content)) {
      values.set(path, await valueOfObjectPath(path, loadObject));
    }
    // only text nodes are changed: values can never become html
    const walker = el.ownerDocument.createTreeWalker(el, SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (hasBindingToken(node.nodeValue)) {
        node.nodeValue = interpolateBindings(node.nodeValue!, (path) => values.get(path));
      }
    }
  }
}

type ObjectLoader = (name: string) => Promise<unknown>;

/** `personalInfo.job.title` -> value of `job.title` in the data of the `personalInfo` source */
async function valueOfObjectPath(path: string, loadObject: ObjectLoader): Promise<unknown> {
  const [name, ...rest] = path.split('.');
  const data = await loadObject(name);
  return rest.length ? getByPath(data, rest.join('.')) : data;
}

function isStaticData(raw: unknown): boolean {
  return !!raw && typeof raw !== 'function' && !isObservable(raw);
}

function declaredSchema(source: DynamicDataStructure, sampleRow?: unknown): DynamicDataStructure[] {
  if (source.fields?.length) return source.fields;
  if (sampleRow) return schemaFromRow(sampleRow);
  return Array.isArray(source.rawData) ? schemaFromRow(source.rawData[0]) : [];
}

/** the value of `rawData`: static data, or the result of the function / observable */
async function loadRawData(source: DynamicDataStructure, input: DynamicDataInput = {}): Promise<unknown> {
  const raw = source.rawData;
  if (!raw) return undefined;

  if (typeof raw === 'function') {
    const request: DynamicDataInput = { ...input };
    // default values of the input parameters declared by the data source
    if (source.inputData?.length && !request.params) {
      request.params = Object.fromEntries(source.inputData.map((p) => [p.name, p.value]));
    }
    const result = raw(request);
    return isObservable(result) ? await firstValueFrom(result) : await result;
  }
  return isObservable(raw) ? await firstValueFrom(raw) : raw;
}
