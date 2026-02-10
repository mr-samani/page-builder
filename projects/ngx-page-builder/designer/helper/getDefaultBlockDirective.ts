import { NgxDraggableDirective, NgxDropListDirective, IDropEvent } from 'ngx-drag-drop-kit';
import { Directive, PageItem } from 'ngx-page-builder/core';

export function getDefaultBlockDirective(pageItem: PageItem, onDropFn: Function) {
  return new Promise<Directive[]>((resolve, reject) => {
    // حتما باید برای همه المان ها NgxDraggableDirective اضاف شود در غیر اینصورت در جابجایی ایتم ها ایندکس اشتباه خواهد بود
    // حتی اگر disableMovement باشد باید NgxDraggableDirective اضافه شود
    let dir: Directive[] = [{ directive: NgxDraggableDirective }];

    if (pageItem.canHaveChild) {
      dir = [
        ...dir,
        {
          directive: NgxDropListDirective,
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
