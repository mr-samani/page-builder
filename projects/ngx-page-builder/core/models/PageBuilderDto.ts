import { IPageBuilderDto } from '../contracts/IPageBuilderDto';
import { Page } from './Page';
import { PageOrientation, PageSize } from './types';

export class PageBuilderDto implements IPageBuilderDto {
  config: PageBuilderConfig = new PageBuilderConfig();
  pages: Page[] = [];

  constructor(data?: PageBuilderDto | any) {
    this.config = new PageBuilderConfig(data?.config);

    if (data && data.pages) {
      this.pages = data.pages.map((p: Page) => Page.fromJSON(p));
    } else {
      this.pages = [];
    }
  }
  static fromJSON(data: IPageBuilderDto): PageBuilderDto {
    return new PageBuilderDto(data);
  }
}
export class PageBuilderConfig {
  title?: string = '';
  description?: string = '';
  size: PageSize = 'A4';
  orientation: PageOrientation = 'Portrait';
  direction: 'rtl' | 'ltr' = 'ltr';
  constructor(data?: PageBuilderConfig | any) {
    if (data) {
      for (var property in data) {
        if (this.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
