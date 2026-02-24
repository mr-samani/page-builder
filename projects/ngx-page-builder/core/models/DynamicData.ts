import { Observable } from 'rxjs';

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
   */
  values?: DynamicDataStructure<ValueType>[];

  /**
   * Fill in this field when the data result is a collection of records (list or array).
   */
  list?: DynamicDataStructure<ValueType>[][] | PromiseDynamicDataList | ObservableDynamicDataList;
  type: DynamicValueType;

  /**
   * result value
   */
  value?: ValueType | string | number | boolean | Date | null | undefined;

  inputData?: DynamicDataInputParameter[];
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
