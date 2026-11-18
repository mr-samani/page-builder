import { providePageBuilder } from 'ngx-page-builder/designer';
import { providePagePreview } from 'ngx-page-builder/preview';
import { TEXT_BOX_SOURCE } from './textbox.source';
import { TEXT_BOX_PREVIEW } from './textbox-preview.source';

// Add these entries to the existing provider configuration; keep your other custom sources.
export const textboxProviders = [
  providePageBuilder({
    customSources: [TEXT_BOX_SOURCE],
  }),
  providePagePreview({
    customSources: [TEXT_BOX_PREVIEW],
  }),
];
