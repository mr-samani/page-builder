import type { Observable } from 'rxjs/internal/Observable';
import type { DataFilter, DataSort } from './DataSourceSetting';

/**
 * Describes one dynamic data source.
 *
 * - `type: Array`  -> a collection (list). `fields` is the structure of ONE record. Blocks inside a collection are
 *   bound to these fields (`dataSource.binding = 'price'`).
 * - `type: Object` -> a single object. `fields` is the structure of its properties. Any other block can be bound to a
 *   non list field of it (`dataSource.binding = '<name>.job.title'`, shown as `{{personalInfo.job.title}}`).
 *
 * The designer only needs the STRUCTURE (`name`, `type`, `fields`): it never has to load data, it builds sample data
 * from the structure. The VALUES (`rawData`) are only needed where the page is viewed.
 */
export interface DynamicDataStructure<DTO = any> {
  /**
   * Unique ID (required for collections: `dataSource.id` of a collection block refers to it)
   */
  id?: string;

  /**
   * NameSpace: first segment of the binding path of an object source (`personalInfo` in `personalInfo.job.title`).
   * Must be unique and must not contain dots.
   */
  name: string;
  displayName: string;

  /**
   * Structure of the data: properties of an object, or of ONE record of a collection.
   * Declare it for every Array / Object source: the designer binds blocks to it even when there is no data.
   * If omitted, the structure is inferred from the first record of a static `rawData` list.
   */
  fields?: DynamicDataStructure[] | null;

  /**
   * The data, used by the viewer (not needed by the designer):
   * - a collection: an array of records
   * - an object: the object
   * - a function (Promise / Observable) returning one of them, e.g. an API call. The designer never calls it.
   */
  rawData?: DTO | DTO[] | Observable<DTO | DTO[]> | DynamicDataLoader<DTO>;
  type: DynamicValueType;

  inputData?: DynamicDataInputParameter[] | null;
}

export type DynamicDataLoader<DTO = any> = (
  parameters: DynamicDataInput,
) => Promise<DTO | DTO[]> | Observable<DTO | DTO[]>;

export interface CustomInputData {}

export interface DynamicDataInputParameter {
  name: string;
  label: string;
  options?: { id: string | number; title: string }[];
  type: DynamicDataInputType;
  value?: any;
}

export interface DynamicDataInput<InputData = { [key: string]: any }> {
  take?: number;
  skip?: number;

  params?: InputData;

  /**
   * Filters / sorts chosen in the designer. When `rawData` is a function (API), the function is responsible for
   * applying them (server side paging). When `rawData` is a static array they are applied by the library.
   */
  filters?: DataFilter[];
  sorts?: DataSort[];
}
export enum DynamicValueType {
  String,
  Int,
  Boolean,
  Date,
  Time,
  DateTime,
  Array,
  Object,
}

export enum DynamicDataInputType {
  Text,
  Textarea,
  Number,
  Select,
  AutoComplete,
}
