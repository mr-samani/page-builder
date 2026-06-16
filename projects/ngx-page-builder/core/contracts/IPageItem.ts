import { Type } from '@angular/core';
import { ISourceOptions } from '../models/SourceItem';
import { DataSourceSetting } from '../models/DataSourceSetting';

export interface IPageItem {
  id?: string;
  dataSource?: DataSourceSetting;
  parent?: IPageItem;
  el?: HTMLElement | null;
  children?: IPageItem[];
  tag: string;
  canHaveChild?: boolean;
  /** content in html editor */
  content?: string;
  component?: () => Promise<Type<any>>;
  componentKey?: string;
  options?: ISourceOptions;
  template?: IPageItem;
  /**
   * Disable movement of the source item
   * @example pagebreak cannot move to child items
   */
  disableMovement?: boolean;
  /**
   * disable move inner child item to outside of self list
   * @example prevent dragging child item of Item-Collection to another list
   */
  lockMoveInnerChild?: boolean;
  disableDelete?: boolean;
  isTemplateContainer?: boolean;

  classList?: string[];

  /** like color:white; */
  css?: string;
}
