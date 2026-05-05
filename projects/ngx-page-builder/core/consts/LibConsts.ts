import { ViewMode } from './ViewMode';
import { PageBuilderToolbarConfig } from '../models/PageBuilderConfiguration';
import { SourceItem } from '../models/SourceItem';
import { CMSPage } from '../models/CMSPage';

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
  /** enable key shortcuts
   * - like delete block with press [del] key in keyboard
   */
  enableShotcuts: boolean;
  /** show export button in block setting */
  enableExportAsPlugin: boolean;

  enableCssVariable: boolean;

  showPlugins: boolean;
  canDeletePlugin: boolean;

  toolbarConfig?: PageBuilderToolbarConfig;

  publicCss: string[];
  publicJs: string[];

  /**
   * used in link tag
   */
  cmsPages: CMSPage[];
} = {
  SourceItemList: [],
  backendProxyImportUrl: 'http://localhost:3000/api/render',
  enableHistory: false,
  enableShotcuts: false,
  enableAddCssFile: false,
  enableExportAsPlugin: false,
  enableCssVariable: false,
  showPlugins: false,
  canDeletePlugin: false,
  viewMode: 'PrintPage',
  toolbarConfig: new PageBuilderToolbarConfig(),
  publicCss: [],
  publicJs: [],
  cmsPages: [],
};
