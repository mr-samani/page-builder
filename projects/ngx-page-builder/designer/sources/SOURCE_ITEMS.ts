import { CollectionItemSource } from './collection-item/definition';
import { HeroTableSource } from './hero-table/definition';
import { PageBreakSource } from './page-break/definition';
import { ColumnSource } from './column/definition';
import { randomNumber } from 'ngx-page-builder/core';
import type { SourceItem, SourceSettingField } from 'ngx-page-builder/core';

type SourceOverrides = Partial<Omit<SourceItem, 'tag' | 'title' | 'icon'>>;

/**
 * Creates a native HTML source definition. Category is mandatory here on purpose:
 * every built-in block belongs to a deliberate library category.
 */
function htmlBlock(
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

function inputBlock(title: string, type: string, description: string): SourceItem {
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

const INPUT_SETTINGS: SourceSettingField[] = [
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

const METER_SETTINGS: SourceSettingField[] = [
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

const PROGRESS_SETTINGS: SourceSettingField[] = [
  { name: 'value', title: 'Current value', type: 'number', group: 'Value', min: 0, maxAttribute: 'max', step: 1 },
  { name: 'max', title: 'Maximum', type: 'number', group: 'Value', min: 1, step: 1 },
];

const createListStarterItems = (): SourceItem[] =>
  ['First list item', 'Second list item', 'Third list item'].map((content) =>
    htmlBlock('li', 'List Item', 'data', 'collection', 'An editable list item.', { content }),
  );

const FIGURE_STARTER_CHILDREN: SourceItem[] = [
  htmlBlock('img', 'Image', 'media', 'img', 'Image inside the figure.', {
    options: { attributes: { src: 'assets/default-image.png', alt: 'Figure image', loading: 'lazy' } },
    classList: ['img'],
  }),
  htmlBlock('figcaption', 'Figure Caption', 'media', 'paragraph', 'A caption for this image.', {
    content: 'Add a caption for this image.',
  }),
];

const DISCLOSURE_STARTER_CHILDREN: SourceItem[] = [
  htmlBlock('summary', 'Disclosure Summary', 'actions', 'paragraph', 'The visible heading for a disclosure element.', {
    content: 'More information',
  }),
  htmlBlock('p', 'Paragraph', 'typography', 'paragraph', 'Disclosure body content.', {
    content: 'Add the expandable content here.',
  }),
];

const FORM_STARTER_CHILDREN: SourceItem[] = [
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

const SELECT_STARTER_CHILDREN: SourceItem[] = [
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

const TABLE_HEADER_CELLS = ['Name', 'Role', 'Status'].map((content) =>
  htmlBlock('th', 'Header Cell', 'data', 'table', 'Column heading.', { content }),
);

const TABLE_BODY_ROWS = [
  ['Alex Morgan', 'Designer', 'Active'],
  ['Jamie Lee', 'Developer', 'Pending'],
].map((cells) =>
  htmlBlock('tr', 'Table Row', 'data', 'table', 'Sample data row.', {
    canHaveChild: true,
    initialChildren: cells.map((content) => htmlBlock('td', 'Table Cell', 'data', 'table', 'Table data.', { content })),
  }),
);

const TABLE_STARTER_CHILDREN: SourceItem[] = [
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

const DESCRIPTION_LIST_STARTER_CHILDREN: SourceItem[] = [
  htmlBlock('dt', 'Description Term', 'data', 'paragraph', 'The term being defined.', { content: 'First term' }),
  htmlBlock('dd', 'Description Details', 'data', 'paragraph', 'The definition for this term.', {
    content: 'Describe the first term here.',
  }),
  htmlBlock('dt', 'Description Term', 'data', 'paragraph', 'The term being defined.', { content: 'Second term' }),
  htmlBlock('dd', 'Description Details', 'data', 'paragraph', 'The definition for this term.', {
    content: 'Describe the second term here.',
  }),
];

export const SOURCE_ITEMS: SourceItem[] = [
  // Layout & semantic structure
  htmlBlock('div', 'Div', 'layout', 'div', 'A generic block container for grouping page elements.', {
    canHaveChild: true,
  }),
  htmlBlock('div', 'Container', 'layout', 'div', 'A content container with a semantic container class.', {
    canHaveChild: true,
    classList: ['container'],
  }),
  htmlBlock('section', 'Section', 'layout', 'section', 'A thematic section of a page.', { canHaveChild: true }),
  htmlBlock('main', 'Main Content', 'layout', 'layout', 'The primary content area of the document.', {
    canHaveChild: true,
  }),
  htmlBlock('header', 'Header', 'layout', 'layout', 'Introductory content or a page section header.', {
    canHaveChild: true,
  }),
  htmlBlock('footer', 'Footer', 'layout', 'layout', 'Footer content for a page or section.', { canHaveChild: true }),
  htmlBlock('nav', 'Navigation', 'layout', 'link', 'A group of primary navigation links.', { canHaveChild: true }),
  htmlBlock('article', 'Article', 'layout', 'page', 'A self-contained piece of content.', { canHaveChild: true }),
  htmlBlock('aside', 'Aside', 'layout', 'layout', 'Supporting or complementary content.', { canHaveChild: true }),
  ColumnSource,

  // Typography & inline content
  htmlBlock('h1', 'Heading 1', 'typography', 'h1', 'The main page heading.', { content: 'Heading 1' }),
  htmlBlock('h2', 'Heading 2', 'typography', 'h2', 'A level-two section heading.', { content: 'Heading 2' }),
  htmlBlock('h3', 'Heading 3', 'typography', 'h3', 'A level-three section heading.', { content: 'Heading 3' }),
  htmlBlock('h4', 'Heading 4', 'typography', 'h4', 'A level-four heading.', { content: 'Heading 4' }),
  htmlBlock('h5', 'Heading 5', 'typography', 'h5', 'A level-five heading.', { content: 'Heading 5' }),
  htmlBlock('h6', 'Heading 6', 'typography', 'h6', 'A level-six heading.', { content: 'Heading 6' }),
  htmlBlock('p', 'Paragraph', 'typography', 'paragraph', 'A paragraph of body text.', {
    content: 'Write your text here.',
  }),
  htmlBlock('span', 'Inline Text', 'typography', 'span', 'An inline wrapper for short text or inline styling.', {
    content: 'Inline text',
  }),
  htmlBlock('strong', 'Strong Text', 'typography', 'h', 'Important text with semantic emphasis.', {
    content: 'Important text',
  }),
  htmlBlock('em', 'Emphasis', 'typography', 'h', 'Emphasized inline text.', { content: 'Emphasized text' }),
  htmlBlock('small', 'Small Text', 'typography', 'paragraph', 'Side notes, captions, or fine print.', {
    content: 'Small text',
  }),
  htmlBlock('mark', 'Highlighted Text', 'typography', 'paragraph', 'Highlighted text for relevant passages.', {
    content: 'Highlighted text',
  }),
  htmlBlock('blockquote', 'Block Quote', 'typography', 'paragraph', 'A quotation displayed as a separate block.', {
    content: 'Quoted text',
    canHaveChild: true,
  }),
  htmlBlock('pre', 'Preformatted Text', 'typography', 'paragraph', 'Preserves whitespace and line breaks.', {
    content: 'Preformatted text',
  }),
  htmlBlock('code', 'Code', 'typography', 'paragraph', 'Inline code or a code fragment.', {
    content: 'const value = true;',
  }),
  htmlBlock('address', 'Address', 'typography', 'paragraph', 'Contact information for a person or organization.', {
    content: 'Contact information',
    canHaveChild: true,
  }),
  htmlBlock('time', 'Time', 'typography', 'paragraph', 'A machine-readable date or time.', {
    content: '2026-11-02',
    options: { attributes: { datetime: '2026-11-02' } },
    settings: [
      {
        name: 'datetime',
        title: 'Machine-readable date/time',
        type: 'text',
        group: 'Time',
        placeholder: '2026-11-02 or 2026-11-02T09:30',
        description: 'The value used by browsers and assistive technology.',
      },
    ],
  }),
  htmlBlock(
    'abbr',
    'Abbreviation',
    'typography',
    'paragraph',
    'An abbreviation with an optional expanded description.',
    {
      content: 'HTML',
      options: { attributes: { title: 'HyperText Markup Language' } },
      settings: [
        { name: 'title', title: 'Expanded description', type: 'text', group: 'Accessibility', fullWidth: true },
      ],
    },
  ),
  htmlBlock('sub', 'Subscript', 'typography', 'paragraph', 'Subscript inline text.', { content: '2' }),
  htmlBlock('sup', 'Superscript', 'typography', 'paragraph', 'Superscript inline text.', { content: '2' }),
  htmlBlock('del', 'Deleted Text', 'typography', 'paragraph', 'Text removed from a document.', {
    content: 'Deleted text',
  }),
  htmlBlock('ins', 'Inserted Text', 'typography', 'paragraph', 'Text inserted into a document.', {
    content: 'Inserted text',
  }),
  htmlBlock('cite', 'Citation', 'typography', 'paragraph', 'A citation or reference to a creative work.', {
    content: 'Citation',
  }),
  htmlBlock('q', 'Inline Quote', 'typography', 'paragraph', 'A short inline quotation.', { content: 'Quoted text' }),
  htmlBlock('hr', 'Divider', 'typography', 'section', 'A thematic break between content sections.'),
  htmlBlock('br', 'Line Break', 'typography', 'paragraph', 'A simple line break inside text.'),

  // Media
  htmlBlock('img', 'Image', 'media', 'img', 'Responsive-ready image with lazy loading and alt text.', {
    options: { attributes: { src: 'assets/default-image.png', alt: 'Image description', loading: 'lazy' } },
    settings: [
      { name: 'src', title: 'Image URL', type: 'url', group: 'Image', fullWidth: true },
      { name: 'alt', title: 'Alternative text', type: 'text', group: 'Image', fullWidth: true },
      { name: 'width', title: 'Width', type: 'text', group: 'Dimensions', placeholder: '100%' },
      { name: 'height', title: 'Height', type: 'text', group: 'Dimensions', placeholder: 'auto' },
      {
        name: 'loading',
        title: 'Loading',
        type: 'select',
        group: 'Advanced',
        options: [
          { label: 'Lazy', value: 'lazy' },
          { label: 'Eager', value: 'eager' },
        ],
      },
      {
        name: 'decoding',
        title: 'Decoding',
        type: 'select',
        group: 'Advanced',
        options: [
          { label: 'Async', value: 'async' },
          { label: 'Sync', value: 'sync' },
          { label: 'Auto', value: 'auto' },
        ],
      },
    ],
    classList: ['img'],
  }),
  htmlBlock(
    'picture',
    'Responsive Picture',
    'media',
    'img',
    'A responsive image wrapper that can contain source and image elements.',
    { canHaveChild: true },
  ),
  htmlBlock('source', 'Media Source', 'media', 'img', 'A media source used inside picture, audio or video.', {
    options: { attributes: { src: '', type: 'image/webp' } },
    settings: [
      { name: 'src', title: 'Source URL', type: 'url', group: 'Source', fullWidth: true },
      { name: 'type', title: 'MIME type', type: 'text', group: 'Source', placeholder: 'image/webp' },
      { name: 'media', title: 'Media query', type: 'text', group: 'Advanced', placeholder: '(min-width: 800px)' },
      { name: 'srcset', title: 'Source set', type: 'text', group: 'Advanced', fullWidth: true },
    ],
  }),
  htmlBlock('figure', 'Figure', 'media', 'img', 'A media item with an optional caption.', {
    canHaveChild: true,
    initialChildren: FIGURE_STARTER_CHILDREN,
  }),
  htmlBlock('figcaption', 'Figure Caption', 'media', 'paragraph', 'A caption for a figure.', {
    content: 'Figure caption',
    canHaveChild: true,
  }),
  htmlBlock('video', 'Video', 'media', 'img', 'An HTML video player with native controls.', {
    canHaveChild: true,
    options: { attributes: { controls: true, preload: 'metadata', playsinline: true } },
    settings: [
      { name: 'src', title: 'Video URL', type: 'url', group: 'Source', fullWidth: true },
      { name: 'poster', title: 'Poster image', type: 'url', group: 'Source', fullWidth: true },
      { name: 'controls', title: 'Show controls', type: 'checkbox', group: 'Playback' },
      { name: 'autoplay', title: 'Autoplay', type: 'checkbox', group: 'Playback' },
      { name: 'muted', title: 'Muted', type: 'checkbox', group: 'Playback' },
      { name: 'loop', title: 'Loop', type: 'checkbox', group: 'Playback' },
      { name: 'playsinline', title: 'Play inline', type: 'checkbox', group: 'Playback' },
      {
        name: 'preload',
        title: 'Preload',
        type: 'select',
        group: 'Advanced',
        options: [
          { label: 'Metadata', value: 'metadata' },
          { label: 'Auto', value: 'auto' },
          { label: 'None', value: 'none' },
        ],
      },
    ],
  }),
  htmlBlock('audio', 'Audio', 'media', 'img', 'An HTML audio player with native controls.', {
    canHaveChild: true,
    options: { attributes: { controls: true, preload: 'metadata' } },
    settings: [
      { name: 'src', title: 'Audio URL', type: 'url', group: 'Source', fullWidth: true },
      { name: 'controls', title: 'Show controls', type: 'checkbox', group: 'Playback' },
      { name: 'autoplay', title: 'Autoplay', type: 'checkbox', group: 'Playback' },
      { name: 'muted', title: 'Muted', type: 'checkbox', group: 'Playback' },
      { name: 'loop', title: 'Loop', type: 'checkbox', group: 'Playback' },
      {
        name: 'preload',
        title: 'Preload',
        type: 'select',
        group: 'Advanced',
        options: [
          { label: 'Metadata', value: 'metadata' },
          { label: 'Auto', value: 'auto' },
          { label: 'None', value: 'none' },
        ],
      },
    ],
  }),
  htmlBlock('iframe', 'Embedded Content', 'media', 'layout', 'An isolated frame for embedding external content.', {
    options: {
      attributes: { src: 'about:blank', title: 'Embedded content', loading: 'lazy', width: '100%', height: '320' },
    },
    settings: [
      { name: 'src', title: 'Embed URL', type: 'url', group: 'Source', fullWidth: true },
      { name: 'title', title: 'Accessible title', type: 'text', group: 'Source', fullWidth: true },
      { name: 'width', title: 'Width', type: 'text', group: 'Dimensions', placeholder: '100%' },
      { name: 'height', title: 'Height', type: 'text', group: 'Dimensions', placeholder: '320' },
      {
        name: 'loading',
        title: 'Loading',
        type: 'select',
        group: 'Advanced',
        options: [
          { label: 'Lazy', value: 'lazy' },
          { label: 'Eager', value: 'eager' },
        ],
      },
      { name: 'allowfullscreen', title: 'Allow fullscreen', type: 'checkbox', group: 'Advanced' },
    ],
  }),

  // Links & actions
  htmlBlock('a', 'Link', 'actions', 'link', 'A navigational link.', {
    content: 'Link text',
    options: { attributes: { href: '#', target: '_self' } },
    settings: [
      { name: 'href', title: 'Destination URL', type: 'url', group: 'Link', fullWidth: true },
      {
        name: 'target',
        title: 'Open in',
        type: 'select',
        group: 'Link',
        options: [
          { label: 'Same tab', value: '_self' },
          { label: 'New tab', value: '_blank' },
        ],
      },
      { name: 'rel', title: 'Relationship', type: 'text', group: 'Advanced', placeholder: 'noopener noreferrer' },
      { name: 'download', title: 'Download link', type: 'checkbox', group: 'Advanced' },
    ],
  }),
  htmlBlock('button', 'Button', 'actions', 'rectangle-fill', 'An actionable button.', {
    content: 'Button',
    canHaveChild: true,
    options: { attributes: { type: 'button' } },
    settings: [
      {
        name: 'type',
        title: 'Button type',
        type: 'select',
        group: 'Behavior',
        options: [
          { label: 'Button', value: 'button' },
          { label: 'Submit', value: 'submit' },
          { label: 'Reset', value: 'reset' },
        ],
      },
      { name: 'name', title: 'Name', type: 'text', group: 'Behavior' },
      { name: 'value', title: 'Value', type: 'text', group: 'Behavior' },
      { name: 'disabled', title: 'Disabled', type: 'checkbox', group: 'Behavior' },
      { name: 'form', title: 'Form ID', type: 'text', group: 'Advanced' },
    ],
  }),
  htmlBlock('dialog', 'Dialog', 'actions', 'layout', 'A native dialog surface for modal or non-modal content.', {
    canHaveChild: true,
  }),
  htmlBlock('details', 'Disclosure', 'actions', 'layout', 'Expandable content using native disclosure behavior.', {
    canHaveChild: true,
    initialChildren: DISCLOSURE_STARTER_CHILDREN,
    settings: [{ name: 'open', title: 'Open by default', type: 'checkbox', group: 'Behavior' }],
  }),
  htmlBlock('summary', 'Disclosure Summary', 'actions', 'paragraph', 'The visible heading for a disclosure element.', {
    content: 'Show details',
    canHaveChild: true,
  }),

  // Forms
  htmlBlock('form', 'Form', 'forms', 'input', 'A form container for user input controls.', {
    canHaveChild: true,
    options: { attributes: { action: '#', method: 'get' } },
    initialChildren: FORM_STARTER_CHILDREN,
    settings: [
      { name: 'action', title: 'Submit URL', type: 'url', group: 'Submission', fullWidth: true },
      {
        name: 'method',
        title: 'Method',
        type: 'select',
        group: 'Submission',
        options: [
          { label: 'GET', value: 'get' },
          { label: 'POST', value: 'post' },
        ],
      },
      {
        name: 'enctype',
        title: 'Encoding',
        type: 'select',
        group: 'Advanced',
        options: [
          { label: 'URL encoded', value: 'application/x-www-form-urlencoded' },
          { label: 'Multipart', value: 'multipart/form-data' },
          { label: 'Plain text', value: 'text/plain' },
        ],
      },
      {
        name: 'autocomplete',
        title: 'Autocomplete',
        type: 'select',
        group: 'Advanced',
        options: [
          { label: 'On', value: 'on' },
          { label: 'Off', value: 'off' },
        ],
      },
      { name: 'novalidate', title: 'Disable browser validation', type: 'checkbox', group: 'Advanced' },
    ],
  }),
  htmlBlock('label', 'Label', 'forms', 'paragraph', 'An accessible label for a form control.', {
    content: 'Field label',
    canHaveChild: true,
    options: { attributes: { for: '' } },
    settings: [
      {
        name: 'for',
        title: 'Control ID',
        type: 'text',
        group: 'Accessibility',
        description: 'Must match the id of the related input.',
      },
    ],
  }),
  htmlBlock('fieldset', 'Fieldset', 'forms', 'input', 'Groups related form controls.', {
    canHaveChild: true,
    settings: [
      { name: 'name', title: 'Name', type: 'text', group: 'General' },
      { name: 'disabled', title: 'Disabled', type: 'checkbox', group: 'General' },
      { name: 'form', title: 'Form ID', type: 'text', group: 'Advanced' },
    ],
  }),
  htmlBlock('legend', 'Fieldset Legend', 'forms', 'paragraph', 'A caption for a fieldset.', { content: 'Group title' }),
  htmlBlock('output', 'Form Output', 'forms', 'input', 'Displays the result of a calculation or user action.', {
    content: 'Result',
  }),
  inputBlock('Text Input', 'text', 'A single-line text field.'),
  inputBlock('Email Input', 'email', 'An email field with browser validation.'),
  inputBlock('Password Input', 'password', 'A masked password field.'),
  inputBlock('Number Input', 'number', 'A numeric input field.'),
  inputBlock('Telephone Input', 'tel', 'A telephone number field.'),
  inputBlock('Date Input', 'date', 'A native date picker field.'),
  inputBlock('Range Input', 'range', 'A slider for selecting a numeric value.'),
  inputBlock('Color Input', 'color', 'A native color picker field.'),
  inputBlock('Search Input', 'search', 'A search field.'),
  inputBlock('File Input', 'file', 'A file upload control.'),
  inputBlock('Checkbox', 'checkbox', 'A checkbox for independent selections.'),
  inputBlock('Radio Button', 'radio', 'A radio control for a mutually exclusive choice.'),
  inputBlock('Submit Button', 'submit', 'A form submit control.'),
  inputBlock('Reset Button', 'reset', 'A form reset control.'),
  htmlBlock('textarea', 'Text Area', 'forms', 'input', 'A multi-line text field.', {
    options: { attributes: { name: `message-${randomNumber(4)}`, rows: '4', placeholder: 'Write your message' } },
    settings: [
      { name: 'name', title: 'Name', type: 'text', group: 'General' },
      { name: 'placeholder', title: 'Placeholder', type: 'text', group: 'General', fullWidth: true },
      { name: 'rows', title: 'Rows', type: 'number', group: 'Dimensions', min: 1, max: 30, step: 1 },
      { name: 'cols', title: 'Columns', type: 'number', group: 'Dimensions', min: 1, step: 1 },
      { name: 'minlength', title: 'Minimum length', type: 'number', group: 'Validation', min: 0 },
      { name: 'maxlength', title: 'Maximum length', type: 'number', group: 'Validation', min: 1 },
      { name: 'required', title: 'Required', type: 'checkbox', group: 'Validation' },
      { name: 'disabled', title: 'Disabled', type: 'checkbox', group: 'Validation' },
      { name: 'readonly', title: 'Read only', type: 'checkbox', group: 'Validation' },
      {
        name: 'wrap',
        title: 'Text wrapping',
        type: 'select',
        group: 'Advanced',
        options: [
          { label: 'Soft', value: 'soft' },
          { label: 'Hard', value: 'hard' },
          { label: 'Off', value: 'off' },
        ],
      },
    ],
  }),
  htmlBlock('select', 'Select', 'forms', 'input', 'A dropdown selection control.', {
    canHaveChild: true,
    initialChildren: SELECT_STARTER_CHILDREN,
    settings: [
      { name: 'name', title: 'Name', type: 'text', group: 'General' },
      { name: 'required', title: 'Required', type: 'checkbox', group: 'General' },
      { name: 'disabled', title: 'Disabled', type: 'checkbox', group: 'General' },
      { name: 'multiple', title: 'Allow multiple', type: 'checkbox', group: 'Advanced' },
      { name: 'size', title: 'Visible options', type: 'number', group: 'Advanced', min: 1, step: 1 },
    ],
  }),
  htmlBlock('option', 'Select Option', 'forms', 'paragraph', 'An option inside a select control.', {
    content: 'Option',
    options: { attributes: { value: 'option' } },
    settings: [
      { name: 'value', title: 'Submitted value', type: 'text', group: 'Option' },
      { name: 'label', title: 'Display label', type: 'text', group: 'Option' },
      { name: 'selected', title: 'Selected by default', type: 'checkbox', group: 'State' },
      { name: 'disabled', title: 'Disabled', type: 'checkbox', group: 'State' },
    ],
  }),

  // Lists & data
  htmlBlock('ul', 'Unordered List', 'data', 'collection', 'A ready-to-edit bulleted list with three starter items.', {
    canHaveChild: true,
    initialChildren: createListStarterItems(),
  }),
  htmlBlock('ol', 'Ordered List', 'data', 'collection', 'A ready-to-edit numbered list with three starter items.', {
    canHaveChild: true,
    initialChildren: createListStarterItems(),
    settings: [
      { name: 'start', title: 'Start number', type: 'number', group: 'Numbering', step: 1 },
      { name: 'reversed', title: 'Reverse numbering', type: 'checkbox', group: 'Numbering' },
      {
        name: 'type',
        title: 'Number style',
        type: 'select',
        group: 'Numbering',
        options: [
          { label: 'Numbers', value: '1' },
          { label: 'Uppercase letters', value: 'A' },
          { label: 'Lowercase letters', value: 'a' },
          { label: 'Uppercase Roman', value: 'I' },
          { label: 'Lowercase Roman', value: 'i' },
        ],
      },
    ],
  }),
  htmlBlock('li', 'List Item', 'data', 'collection', 'An item inside an ordered or unordered list.', {
    content: 'List item',
    canHaveChild: true,
    settings: [
      {
        name: 'value',
        title: 'Number override',
        type: 'number',
        group: 'Numbering',
        step: 1,
        description: 'Only applies to items inside an ordered list.',
      },
    ],
  }),
  htmlBlock(
    'dl',
    'Description List',
    'data',
    'collection',
    'A definition list with editable term and description pairs.',
    {
      canHaveChild: true,
      initialChildren: DESCRIPTION_LIST_STARTER_CHILDREN,
    },
  ),
  htmlBlock('dt', 'Description Term', 'data', 'paragraph', 'A term in a description list.', { content: 'Term' }),
  htmlBlock('dd', 'Description Details', 'data', 'paragraph', 'A description for a term.', { content: 'Description' }),
  htmlBlock('table', 'Table', 'data', 'table', 'A semantic table pre-populated with a header and sample rows.', {
    canHaveChild: true,
    initialChildren: TABLE_STARTER_CHILDREN,
  }),
  htmlBlock('thead', 'Table Head', 'data', 'table', 'The header section of a table.', { canHaveChild: true }),
  htmlBlock('tbody', 'Table Body', 'data', 'table', 'The body section of a table.', { canHaveChild: true }),
  htmlBlock('tr', 'Table Row', 'data', 'table', 'A row inside a table.', { canHaveChild: true }),
  htmlBlock('th', 'Header Cell', 'data', 'table', 'A semantic table header cell.', {
    content: 'Heading',
    canHaveChild: true,
  }),
  htmlBlock('td', 'Table Cell', 'data', 'table', 'A standard table data cell.', {
    content: 'Cell',
    canHaveChild: true,
  }),
  htmlBlock('caption', 'Table Caption', 'data', 'table', 'A title or caption for a table.', {
    content: 'Table caption',
  }),
  htmlBlock('colgroup', 'Column Group', 'data', 'table', 'Groups columns in a table.', { canHaveChild: true }),
  htmlBlock('col', 'Table Column', 'data', 'table', 'Defines column-level table styling.', {
    options: { attributes: { span: '1' } },
    settings: [
      { name: 'span', title: 'Number of columns', type: 'number', group: 'Column', min: 1, max: 100, step: 1 },
    ],
  }),
  htmlBlock(
    'progress',
    'Progress',
    'data',
    'collection',
    'A native progress indicator with editable value and maximum.',
    {
      options: { attributes: { value: '60', max: '100' } },
      settings: PROGRESS_SETTINGS,
    },
  ),
  htmlBlock(
    'meter',
    'Meter',
    'data',
    'collection',
    'A scalar measurement with configurable value, range and quality thresholds.',
    {
      options: { attributes: { value: '0.6', min: '0', max: '1', low: '0.25', high: '0.75', optimum: '0.5' } },
      settings: METER_SETTINGS,
    },
  ),
  CollectionItemSource,
  HeroTableSource,

  // Print & page-specific
  PageBreakSource,
];
