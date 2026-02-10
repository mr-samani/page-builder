import { PageBuilderConfig } from '../models/PageBuilderDto';
import { IPage } from './IPage';
import { IStyleSheetFile } from './IStyleSheetFile';

export interface IPagebuilderOutput {
  config: PageBuilderConfig;
  data: IPage[];
  styles: IStyleSheetFile[];
  script?: string;
  html?: string;
}
