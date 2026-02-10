import { PageItem } from "ngx-page-builder/core";

export declare type TableSection = 'thead' | 'tbody' | 'tfoot';
export interface SelectedCellInfo {
  section: TableSection;
  rowIndex: number; // child index of row in section.children[]
  colIndex: number; // child index of cell in row.children[]
  block: PageItem;
}
export interface RangeSelectionInfo {
  section: TableSection;
  row1: number;
  row2: number;
  col1: number;
  col2: number;
  start: { row: number; col: number; block: PageItem };
  end: { row: number; col: number; block: PageItem };
}
