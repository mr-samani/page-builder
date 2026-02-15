import { SourceItem } from '../public-api';
import { ViewMode } from './ViewMode';

export const LibPreviewConsts: {
  viewMode: ViewMode;
  SourceItemList: SourceItem[];
  publicCss: string[];
  publicJs: string[];
} = {
  SourceItemList: [],
  viewMode: 'PrintPage',
  publicCss: [],
  publicJs: [],
};
