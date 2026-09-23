import { Directive, PageItem } from 'ngx-page-builder/core';
import { InlineEditTextDirective } from '../directives/inline-edit-text.directive';
import { NgxDraggable, NgxDropList, IDropEvent } from 'ngx-kit/drag-resize';

export function getDefaultBlockDirective(pageItem: PageItem, onDropFn: Function) {
  return new Promise<Directive[]>((resolve, reject) => {
    // حتما باید برای همه المان ها NgxDraggable اضاف شود در غیر اینصورت در جابجایی ایتم ها ایندکس اشتباه خواهد بود
    // حتی اگر disableMovement باشد باید NgxDraggable اضافه شود
    let dir: Directive[] = [{ directive: NgxDraggable }];
    if (isTextBlock(pageItem) == true) {
      dir.push({
        directive: InlineEditTextDirective,
        inputs: {
          pageItem,
        },
      });
    }
    if (pageItem.canHaveChild) {
      dir = [
        ...dir,
        {
          directive: NgxDropList,
          inputs: {
            data: pageItem.children,
            // must be check in ondrop event
            /// connectedTo: pageItem.lockMoveInnerChild ? `[data-id="${pageItem.id}"]` : undefined,
          },
          outputs: {
            drop: (ev: IDropEvent<PageItem>) => onDropFn(ev, pageItem),
          },
        },
      ];
    }
    resolve(dir);
  });
}
export function getDefaultBlockClasses(pageItem: PageItem): string {
  if (['tr'].indexOf(pageItem.tag) == -1) {
    return 'block-item';
  } else {
    return '';
  }
}

function isTextBlock(pageItem: PageItem) {
  if (pageItem.dataSource?.binding) {
    return false;
  }
  const textBloxkTags = ['a', 'span', 'strong', 'p', 'pre', 'code', 'samp', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  return textBloxkTags.indexOf(pageItem.tag.toLowerCase()) > -1;
}
