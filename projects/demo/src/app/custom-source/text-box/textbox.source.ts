import { SourceItem } from 'ngx-page-builder/core';
import { createTextboxSettings } from './shared/textbox.model';

export const TEXT_BOX_SOURCE = new SourceItem({
  sourceId: 'forms:custom-textbox',
  tag: 'custom-textbox',
  title: 'Textbox',
  icon: 'input',
  category: 'forms',
  description: 'An editable form field with configurable input type, validation and appearance.',
  keywords: ['input', 'textbox', 'text', 'email', 'mobile', 'phone', 'validation', 'form'],
  customComponent: {
    componentKey: 'CustomTextbox',
    componentData: createTextboxSettings(),
    component: () => import('./designer/textbox.component').then((component) => component.TextboxComponent),
    componentSettings: () =>
      import('./designer/textbox-settings.component').then((component) => component.TextboxSettingsComponent),
  },
});
