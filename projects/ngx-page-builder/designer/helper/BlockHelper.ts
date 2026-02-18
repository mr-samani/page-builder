import { Page, PageItem } from 'ngx-page-builder/core';

export abstract class BlockHelper {
  /**
   * find parent by tag
   * @param item pageItem
   * @param tags include tags like=['td','th']
   * @param breakTags break parent tag like=['tbody','thead','tfoot']
   * @returns pageItem or undefined
   */
  static findParentByTag(item: PageItem, tags: string[], breakTags: string[]): PageItem | undefined {
    if (tags.includes(item.tag)) {
      return item;
    }

    if (item.parent) {
      if (breakTags.includes(item.parent.tag)) {
        return undefined;
      }
      return BlockHelper.findParentByTag(item.parent, tags, breakTags);
    }
    return undefined;
  }

  /**
   * find parent children by block id
   * @param list search list
   * @param id string block id
   * @returns parent childrens
   */
  private findParentListById(list: PageItem[], id: string): PageItem[] | null {
    for (const item of list) {
      if (item.id === id) {
        return list; // این لیست شامل بلاک مورد نظر است
      }

      if (item.children && item.children.length > 0) {
        const found = this.findParentListById(item.children, id);
        if (found) return found; // فقط در صورت پیدا شدن بازگشت
      }
    }

    return null;
  }

  /**
   * find block in page tree
   * @param item block item
   * @param pageInfo page
   * @returns PageItem|undefined
   */
  static findInTree(item: PageItem, pageInfo: Page): PageItem | undefined {
    let list = [...pageInfo.headerItems, ...pageInfo.bodyItems, ...pageInfo.footerItems];
    const treeSearch = (list: PageItem[]): PageItem | undefined => {
      for (let i = 0; i < list.length; i++) {
        if (list[i].id == item.id) {
          return list[i];
        }
        if (list[i].children && list[i].children.length > 0) {
          const found = treeSearch(list[i].children);
          if (found) return found;
        }
      }
      return undefined;
    };
    return treeSearch(list);
  }

  static findParentInTree(item: PageItem, pageInfo: Page): PageItem[] | undefined {
    let list = [...pageInfo.headerItems, ...pageInfo.bodyItems, ...pageInfo.footerItems];
    const treeSearch = (list: PageItem[]): PageItem[] | undefined => {
      for (let i = 0; i < list.length; i++) {
        if (list[i].id == item.id) {
          return list;
        }
        if (list[i].children && list[i].children.length > 0) {
          const found = treeSearch(list[i].children);
          if (found) return found;
        }
      }
      return undefined;
    };
    return treeSearch(list);
  }

  static findItemByHtml(el: HTMLElement, pageInfo: Page): PageItem | undefined {
    let list = [...pageInfo.headerItems, ...pageInfo.bodyItems, ...pageInfo.footerItems];
    const treeSearch = (list: PageItem[]): PageItem | undefined => {
      for (let i = 0; i < list.length; i++) {
        if (list[i].el == el) {
          return list[i];
        }
        if (list[i].children && list[i].children.length > 0) {
          const found = treeSearch(list[i].children);
          if (found) return found;
        }
      }
      return undefined;
    };
    let finded = treeSearch(list);
    return finded;
  }
}
