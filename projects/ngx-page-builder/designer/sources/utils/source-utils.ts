import { type SourceItem, randomNumber, type SourceSettingField } from 'ngx-page-builder/core';

type SourceOverrides = Partial<Omit<SourceItem, 'tag' | 'title' | 'icon'>>;

/**
 * Creates a native HTML source definition. Category is mandatory here on purpose:
 * every built-in block belongs to a deliberate library category.
 */
export function htmlBlock(
  tag: string,
  title: string,
  category: string,
  icon: string,
  description: string,
  overrides: SourceOverrides = {},
): SourceItem {
  return {
    sourceId: `source:${category}:${tag}:${title}`,
    tag,
    title,
    category,
    icon,
    description,
    ...overrides,
  } as SourceItem;
}

export function inputBlock(title: string, type: string, description: string): SourceItem {
  const attributes: Record<string, string> = {
    name: `field-${randomNumber(4)}`,
    type,
  };
  if (!['checkbox', 'radio', 'submit', 'reset', 'button'].includes(type)) {
    attributes['placeholder'] = title;
  }
  if (type === 'checkbox' || type === 'radio') attributes['value'] = '1';
  if (type === 'submit') attributes['value'] = 'Submit';
  if (type === 'number' || type === 'range') {
    attributes['min'] = '0';
    attributes['max'] = '100';
    attributes['step'] = '1';
    attributes['value'] = type === 'range' ? '50' : '1';
  }
  if (type === 'color') attributes['value'] = '#2563eb';

  return htmlBlock('input', title, 'forms', 'input', description, {
    options: { attributes },
    settings: INPUT_SETTINGS,
  });
}

export const INPUT_SETTINGS: SourceSettingField[] = [
  {
    name: 'type',
    title: 'Input type',
    type: 'select',
    group: 'General',
    options: [
      { label: 'Text', value: 'text' },
      { label: 'Email', value: 'email' },
      { label: 'Password', value: 'password' },
      { label: 'Number', value: 'number' },
      { label: 'Telephone', value: 'tel' },
      { label: 'Date', value: 'date' },
      { label: 'Range', value: 'range' },
      { label: 'Color', value: 'color' },
      { label: 'Search', value: 'search' },
      { label: 'File', value: 'file' },
      { label: 'Checkbox', value: 'checkbox' },
      { label: 'Radio', value: 'radio' },
      { label: 'Submit', value: 'submit' },
      { label: 'Reset', value: 'reset' },
    ],
  },
  { name: 'name', title: 'Name', type: 'text', group: 'General', placeholder: 'field-name' },
  {
    name: 'value',
    title: 'Value',
    type: 'text',
    group: 'General',
    visibleWhen: {
      attribute: 'type',
      equals: ['text', 'email', 'password', 'tel', 'date', 'color', 'search', 'checkbox', 'radio', 'submit', 'reset'],
    },
  },
  {
    name: 'numericValue',
    title: 'Value',
    attribute: 'value',
    type: 'number',
    group: 'General',
    visibleWhen: { attribute: 'type', equals: ['number', 'range'] },
    minAttribute: 'min',
    maxAttribute: 'max',
    step: 0.1,
  },
  {
    name: 'placeholder',
    title: 'Placeholder',
    type: 'text',
    group: 'General',
    visibleWhen: { attribute: 'type', equals: ['text', 'email', 'password', 'number', 'tel', 'search'] },
  },
  {
    name: 'min',
    title: 'Minimum',
    type: 'number',
    group: 'Validation',
    step: 1,
    maxAttribute: 'max',
    visibleWhen: { attribute: 'type', equals: ['number', 'range'] },
  },
  {
    name: 'max',
    title: 'Maximum',
    type: 'number',
    group: 'Validation',
    step: 1,
    minAttribute: 'min',
    visibleWhen: { attribute: 'type', equals: ['number', 'range'] },
  },
  {
    name: 'step',
    title: 'Step',
    type: 'number',
    group: 'Validation',
    min: 0,
    step: 0.1,
    visibleWhen: { attribute: 'type', equals: ['number', 'range'] },
  },
  { name: 'required', title: 'Required', type: 'checkbox', group: 'Validation' },
  { name: 'disabled', title: 'Disabled', type: 'checkbox', group: 'Validation' },
  {
    name: 'checked',
    title: 'Checked by default',
    type: 'checkbox',
    group: 'Validation',
    visibleWhen: { attribute: 'type', equals: ['checkbox', 'radio'] },
  },
  {
    name: 'multiple',
    title: 'Allow multiple files',
    type: 'checkbox',
    group: 'Advanced',
    visibleWhen: { attribute: 'type', equals: 'file' },
  },
  {
    name: 'accept',
    title: 'Accepted file types',
    type: 'text',
    group: 'Advanced',
    placeholder: '.pdf,image/*',
    visibleWhen: { attribute: 'type', equals: 'file' },
  },
  { name: 'autocomplete', title: 'Autocomplete', type: 'text', group: 'Advanced' },
];

export const METER_SETTINGS: SourceSettingField[] = [
  {
    name: 'value',
    title: 'Current value',
    type: 'number',
    group: 'Value',
    minAttribute: 'min',
    maxAttribute: 'max',
    step: 0.1,
  },
  { name: 'min', title: 'Minimum', type: 'number', group: 'Range', maxAttribute: 'max', step: 0.1 },
  { name: 'max', title: 'Maximum', type: 'number', group: 'Range', minAttribute: 'min', min: 0.1, step: 0.1 },
  { name: 'low', title: 'Low threshold', type: 'number', group: 'Thresholds', step: 0.1 },
  { name: 'high', title: 'High threshold', type: 'number', group: 'Thresholds', step: 0.1 },
  { name: 'optimum', title: 'Optimal value', type: 'number', group: 'Thresholds', step: 0.1 },
];

export const PROGRESS_SETTINGS: SourceSettingField[] = [
  { name: 'value', title: 'Current value', type: 'number', group: 'Value', min: 0, maxAttribute: 'max', step: 1 },
  { name: 'max', title: 'Maximum', type: 'number', group: 'Value', min: 1, step: 1 },
];

export const createListStarterItems = (): SourceItem[] =>
  ['First list item', 'Second list item', 'Third list item'].map((content) =>
    htmlBlock('li', 'List Item', 'data', 'collection', 'An editable list item.', { content }),
  );

export const FIGURE_STARTER_CHILDREN: SourceItem[] = [
  htmlBlock('img', 'Image', 'media', 'img', 'Image inside the figure.', {
    options: { attributes: { src: 'assets/default-image.png', alt: 'Figure image', loading: 'lazy' } },
    classList: ['img'],
  }),
  htmlBlock('figcaption', 'Figure Caption', 'media', 'paragraph', 'A caption for this image.', {
    content: 'Add a caption for this image.',
  }),
];

export const DISCLOSURE_STARTER_CHILDREN: SourceItem[] = [
  htmlBlock('summary', 'Disclosure Summary', 'actions', 'paragraph', 'The visible heading for a disclosure element.', {
    content: 'More information',
  }),
  htmlBlock('p', 'Paragraph', 'typography', 'paragraph', 'Disclosure body content.', {
    content: 'Add the expandable content here.',
  }),
];

export const FORM_STARTER_CHILDREN: SourceItem[] = [
  htmlBlock('label', 'Label', 'forms', 'paragraph', 'Label for the example field.', {
    content: 'Your name',
    options: { attributes: { for: 'name' } },
  }),
  htmlBlock('input', 'Text Input', 'forms', 'input', 'Example form field.', {
    options: {
      attributes: {
        type: 'text',
        name: 'name',
        id: 'name',
        placeholder: 'Enter your name',
      },
    },
    settings: INPUT_SETTINGS,
  }),
  htmlBlock('button', 'Submit Button', 'actions', 'rectangle-fill', 'Submit this form.', {
    content: 'Submit',
    options: { attributes: { type: 'submit' } },
  }),
];

export const SELECT_STARTER_CHILDREN: SourceItem[] = [
  htmlBlock('option', 'Select Option', 'forms', 'paragraph', 'Placeholder choice.', {
    content: 'Choose an option',
    options: { attributes: { value: '' } },
  }),
  htmlBlock('option', 'Select Option', 'forms', 'paragraph', 'First available choice.', {
    content: 'Option One',
    options: { attributes: { value: 'one' } },
  }),
  htmlBlock('option', 'Select Option', 'forms', 'paragraph', 'Second available choice.', {
    content: 'Option Two',
    options: { attributes: { value: 'two' } },
  }),
];

export const TABLE_HEADER_CELLS = ['Name', 'Role', 'Status'].map((content) =>
  htmlBlock('th', 'Header Cell', 'data', 'table', 'Column heading.', { content }),
);

export const TABLE_BODY_ROWS = [
  ['Alex Morgan', 'Designer', 'Active'],
  ['Jamie Lee', 'Developer', 'Pending'],
].map((cells) =>
  htmlBlock('tr', 'Table Row', 'data', 'table', 'Sample data row.', {
    canHaveChild: true,
    initialChildren: cells.map((content) => htmlBlock('td', 'Table Cell', 'data', 'table', 'Table data.', { content })),
  }),
);

export const TABLE_STARTER_CHILDREN: SourceItem[] = [
  htmlBlock('thead', 'Table Head', 'data', 'table', 'Column headings.', {
    canHaveChild: true,
    initialChildren: [
      htmlBlock('tr', 'Table Row', 'data', 'table', 'Header row.', {
        canHaveChild: true,
        initialChildren: TABLE_HEADER_CELLS,
      }),
    ],
  }),
  htmlBlock('tbody', 'Table Body', 'data', 'table', 'Sample data rows.', {
    canHaveChild: true,
    initialChildren: TABLE_BODY_ROWS,
  }),
];

export const DESCRIPTION_LIST_STARTER_CHILDREN: SourceItem[] = [
  htmlBlock('dt', 'Description Term', 'data', 'paragraph', 'The term being defined.', { content: 'First term' }),
  htmlBlock('dd', 'Description Details', 'data', 'paragraph', 'The definition for this term.', {
    content: 'Describe the first term here.',
  }),
  htmlBlock('dt', 'Description Term', 'data', 'paragraph', 'The term being defined.', { content: 'Second term' }),
  htmlBlock('dd', 'Description Details', 'data', 'paragraph', 'The definition for this term.', {
    content: 'Describe the second term here.',
  }),
];
