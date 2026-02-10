export interface DynamicDataStructure {
  id?: string;
  name: string;
  displayName: string;
  values?: DynamicDataStructure[];
  list?: DynamicDataStructure[][];
  type: DynamicValueType;
  value?: string | number | boolean | Date | null;
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
