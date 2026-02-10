import { SourceItem } from './SourceItem';

export class PagePreviewConfiguration {
  customSources?: SourceItem[];
  publicCss?: string[] = [];
  publicJs?: string[] = [];
}
