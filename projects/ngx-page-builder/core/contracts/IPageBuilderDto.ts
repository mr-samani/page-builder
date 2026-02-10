import { PageBuilderConfig } from '../models/PageBuilderDto';
import { IPage } from './IPage';

export interface IPageBuilderDto {
  config: PageBuilderConfig;
  pages: IPage[];
}
