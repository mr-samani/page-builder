export const CssValueTypeList = ['Color', 'Gradient', 'Number', 'Text', 'Image', 'FileId', 'Url'] as const;

export type CssValueType = (typeof CssValueTypeList)[number];

export interface ICssVariable {
  type: CssValueType;
  name: string;
  value: string;
}
