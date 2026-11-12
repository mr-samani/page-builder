export type DataFilterOperator =
  | 'eq'
  | 'ne'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'empty'
  | 'notEmpty';

export interface DataFilter {
  /** field path in the record schema, nested fields use dots: `address.city` */
  field: string;
  operator: DataFilterOperator;
  /** not used by `empty` / `notEmpty` */
  value?: string;
}

export interface DataSort {
  field: string;
  direction: 'asc' | 'desc';
}

export const DATA_FILTER_OPERATORS: { value: DataFilterOperator; label: string; needsValue: boolean }[] = [
  { value: 'eq', label: 'Equals', needsValue: true },
  { value: 'ne', label: 'Not equal', needsValue: true },
  { value: 'contains', label: 'Contains', needsValue: true },
  { value: 'startsWith', label: 'Starts with', needsValue: true },
  { value: 'endsWith', label: 'Ends with', needsValue: true },
  { value: 'gt', label: 'Greater than', needsValue: true },
  { value: 'gte', label: 'Greater or equal', needsValue: true },
  { value: 'lt', label: 'Less than', needsValue: true },
  { value: 'lte', label: 'Less or equal', needsValue: true },
  { value: 'empty', label: 'Is empty', needsValue: false },
  { value: 'notEmpty', label: 'Is not empty', needsValue: false },
];

export class DataSourceSetting<InputData = { [key: string]: any }> {
  /** collection blocks only: id of the collection data source (DynamicDataStructure.id) */
  id!: string;
  skipCount?: number;
  maxResultCount?: number;
  /**
   * The field the block is bound to. The scope is decided by where the block is:
   * - inside a collection: path in the record structure of that collection (`name`, `address.city`)
   * - anywhere else: path starting with the namespace of an object source (`personalInfo.job.title`)
   * Only non list fields can be bound. `PageItem.content` shows it as `{{<binding>}}`.
   */
  binding?: string;

  /** custom input parameters of the data source (see DynamicDataStructure.inputData) */
  params?: InputData;

  /** collection only: keep records that match ALL filters */
  filters?: DataFilter[];
  /** collection only: sort order, first item has the highest priority */
  sorts?: DataSort[];
}
