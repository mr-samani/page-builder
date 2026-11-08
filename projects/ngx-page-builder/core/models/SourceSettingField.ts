/**
 * Declarative settings metadata for native/custom source blocks.
 * The schema is part of the source registry; it is not serialized with PageItem data.
 */
export type SourceSettingFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'range'
  | 'checkbox'
  | 'select'
  | 'url'
  | 'email'
  | 'date'
  | 'datetime-local'
  | 'time'
  | 'color';

export interface SourceSettingOption {
  label: string;
  value: string | number | boolean;
}

export interface SourceSettingCondition {
  /** Attribute whose current value is checked. */
  attribute: string;
  /** Exact value or a list of accepted values. */
  equals?: string | number | boolean | Array<string | number | boolean>;
  /** When true, the field is visible when the attribute is absent/empty. */
  isEmpty?: boolean;
}

export interface SourceSettingField {
  /** Stable key; defaults to `attribute` when omitted. */
  name: string;
  /** Human-readable label. */
  title: string;
  /** Native HTML attribute to update. */
  attribute?: string;
  type: SourceSettingFieldType;
  description?: string;
  placeholder?: string;
  group?: string;
  options?: SourceSettingOption[];
  defaultValue?: string | number | boolean;
  min?: number;
  max?: number;
  /** Read the live lower bound from another attribute (e.g. meter min). */
  minAttribute?: string;
  /** Read the live upper bound from another attribute (e.g. meter max). */
  maxAttribute?: string;
  step?: number;
  rows?: number;
  required?: boolean;
  /** Hide a field unless this condition matches the current attributes. */
  visibleWhen?: SourceSettingCondition;
  /** Render as a full-width control in the settings inspector. */
  fullWidth?: boolean;
}
