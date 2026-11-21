import type { Provider } from '@angular/core';
import { SourceItem } from './SourceItem';

export class PagePreviewConfiguration {
  customSources?: SourceItem[];
  publicCss?: string[] = [];
  publicJs?: string[] = [];
}
