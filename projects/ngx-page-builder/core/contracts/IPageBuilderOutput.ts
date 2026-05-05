import { PageBuilderConfig } from '../models/PageBuilderDto';
import { ICssVariable } from './ICssVariable';
import { IPage } from './IPage';
import { IStyleSheetFile } from './IStyleSheetFile';

export interface IPagebuilderOutput {
  config: PageBuilderConfig;
  data: IPage[];
  styles: IStyleSheetFile[];
  cssVariables: ICssVariable[];
  script?: string;
  html?: string;
}
