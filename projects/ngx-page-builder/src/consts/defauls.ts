import { IDropEvent, NgxDraggableDirective, NgxDropListDirective } from 'ngx-drag-drop-kit';
import { Directive, SourceItem } from '../models/SourceItem';
import { PageItem } from '../models/PageItem';
import { ViewMode } from './ViewMode';
import { PageBuilderToolbarConfig } from '../models/PageBuilderConfiguration';

/** loaded from initial provider
 *
 * - merge SOURCE_ITEMS with custom sources
 */
export const LibConsts: {
  enableAddCssFile: boolean;
  viewMode: ViewMode;
  SourceItemList: SourceItem[];

  /**
   * backend custom api address for handle cors policies to import with url
   * @example backend-api folder
   */
  backendProxyImportUrl: string;

  /** enable history (undo , redo) */
  enableHistory: boolean;
  /** show export button in block setting */
  enableExportAsPlugin: boolean;
  showPlugins: boolean;

  toolbarConfig?: PageBuilderToolbarConfig;

  publicCss: string[];
  publicJs: string[];
} = {
  SourceItemList: [],
  backendProxyImportUrl: 'http://localhost:3000/api/render',
  enableHistory: false,
  enableAddCssFile: false,
  enableExportAsPlugin: false,
  showPlugins: false,
  viewMode: 'PrintPage',
  toolbarConfig: new PageBuilderToolbarConfig(),
  publicCss: [],
  publicJs: [],
};

export const LOCAL_STORAGE_SAVE_KEY = 'page';

export const DEFAULT_IMAGE_URL = '/assets/default-image.png';

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
