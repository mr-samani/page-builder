import { PageConfig } from '../models/Page';
import { IPageItem } from './IPageItem';

export interface IPage {
  headerItems: IPageItem[];
  bodyItems: IPageItem[];
  footerItems: IPageItem[];
  config: PageConfig;
  order: number;
}
