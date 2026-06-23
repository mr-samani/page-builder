import { WEB_BODY_BLOCK } from 'ngx-page-builder/designer/sources/WEB_BODY_BLOCK';
import { LibConsts } from '../consts/LibConsts';
import { IPageBuilderDto } from '../contracts/IPageBuilderDto';
import { Page } from './Page';
import { PageItem } from './PageItem';
import { PageOrientation, PageSize } from './types';

export class PageBuilderDto implements IPageBuilderDto {
  config: PageBuilderConfig = new PageBuilderConfig();
  pages: Page[] = [];

  /**
   *  # allways for load pages in pagebuilder use this function
   *  - validate page data and add body block
   * @param data init pages data
   */
  public setPages(data: Page[]) {
    if (LibConsts.viewMode == 'PrintPage') {
      this.pages = data;
      return;
    }
    const bodyBlock = new PageItem(WEB_BODY_BLOCK);

    let page: Page;
    // if data is null or invalid
    if (!data || !Array.isArray(data) || data.length == 0 || !data.at(0)) {
      page = new Page();
    } else {
      page = data.at(0)!;
    }

    let firstBlock: PageItem | undefined = page.bodyItems.at(0);
    if (firstBlock) {
      if (firstBlock.tag.toLowerCase() != WEB_BODY_BLOCK.tag.toLowerCase()) {
        bodyBlock.children = page.bodyItems.map((x) => (x.parent = bodyBlock));
        page.bodyItems = [bodyBlock];
      } else {
        // todo merge WEB_BODY_BLOCK with saved body
      }
    } else {
      firstBlock = bodyBlock;
      page.bodyItems = [bodyBlock];
    }
    this.pages = [page];
  }
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
        if (Object.hasOwn(this, property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
