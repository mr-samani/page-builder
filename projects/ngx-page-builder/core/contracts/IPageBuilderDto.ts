import { Page } from '../models/Page';
import { PageBuilderConfig } from '../models/PageBuilderDto';
import { IPage } from './IPage';

export interface IPageBuilderDto {
  config: PageBuilderConfig;
  pages: IPage[];

  setPages?(data: Page[]): void;
}
