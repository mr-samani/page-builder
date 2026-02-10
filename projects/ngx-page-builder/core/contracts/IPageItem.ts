import { Type } from '@angular/core';
import { ISourceOptions } from '../models/SourceItem';
import { DataSourceSetting } from '../models/DataSourceSetting';

export interface IPageItem {
  id?: string;
  dataSource?: DataSourceSetting;
  parent?: IPageItem;
  el?: HTMLElement;
  children?: IPageItem[];
  tag: string;
  canHaveChild?: boolean;
  /** content in html editor */
  content?: string;
  component?: () => Promise<Type<any>>;
  componentKey?: string;
  options?: ISourceOptions;
  template?: IPageItem;
  disableMovement?: boolean;
  lockMoveInnerChild?: boolean;
  disableDelete?: boolean;
  isTemplateContainer?: boolean;

  classList?: string[];
}
