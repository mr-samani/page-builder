import { SourceItem } from 'ngx-page-builder/core';

export const TEXT_BOX_PREVIEW = new SourceItem({
  sourceId: 'forms:custom-textbox:preview',
  tag: 'custom-textbox',
  title: 'Textbox',
  icon: 'input',
  customComponent: {
    // Must match the designer source componentKey so saved PageItems resolve to this preview implementation.
    componentKey: 'CustomTextbox',
    component: () =>
      import('./preview/textbox-preview.component').then((component) => component.PreviewTextboxComponent),
  },
});
