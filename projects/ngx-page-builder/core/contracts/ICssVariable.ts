export const CssValueTypeList = ['text', 'color', 'gradient', 'number'] as const;

export type CssValueType = (typeof CssValueTypeList)[number];

export interface ICssVariable {
  type: CssValueType;
  name: string;
  value: string;
}
