import type { Observable } from 'rxjs/internal/Observable';
import type { DataFilter, DataSort } from './DataSourceSetting';

export interface DynamicDataStructure<ValueType = any> {
  /**
   * Unique ID
   */
  id?: string;

  /**
   * NameSpace
   */
  name: string;
  displayName: string;

  /**
   * Fill in this field when the data result is a sample json
   * STRUCTURE of one record of a collection (list). Declare it for every collection so that the designer can
   * bind elements to a field even when the list is empty (or is loaded lazily from an API).
   * If omitted: `values` is used when the type is Array, otherwise it is inferred from the first record of `list`.
   */
  values?: DynamicDataStructure<ValueType>[] | null;

  /**
   * Fill in this field when the data result is a collection of records (list or array).
   */
  list?: DynamicDataStructure<ValueType>[][] | PromiseDynamicDataList | ObservableDynamicDataList;
  type: DynamicValueType;

  /**
   * result value
   */
  value?: ValueType | string | number | boolean | Date | null | undefined;

  inputData?: DynamicDataInputParameter[] | null;
}

declare type ObservableDynamicDataList = (pramaters: DynamicDataInput) => Observable<DynamicDataStructure[][]>;

declare type PromiseDynamicDataList = (pramaters: DynamicDataInput) => Promise<DynamicDataStructure[][]>;

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
   * Filters / sorts chosen in the designer. When `list` is a function (API), the function is responsible for
   * applying them (server side paging). When `list` is a static array they are applied by the library.
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
