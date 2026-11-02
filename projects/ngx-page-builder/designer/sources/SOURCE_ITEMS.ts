import { CollectionItemSource } from './collection-item/definition';
import { HeroTableSource } from './hero-table/definition';
import { PageBreakSource } from './page-break/definition';
import { ColumnSource } from './column/definition';
import { SourceItem, randomNumber } from 'ngx-page-builder/core';

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
    tag,
    title,
    category,
    icon: `assets/icons/${icon}.svg`,
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

  return htmlBlock('input', title, 'forms', 'input', description, {
    options: { attributes },
  });
}

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
  }),
  htmlBlock('figure', 'Figure', 'media', 'img', 'A media item with an optional caption.', { canHaveChild: true }),
  htmlBlock('figcaption', 'Figure Caption', 'media', 'paragraph', 'A caption for a figure.', {
    content: 'Figure caption',
    canHaveChild: true,
  }),
  htmlBlock('video', 'Video', 'media', 'img', 'An HTML video player with native controls.', {
    canHaveChild: true,
    options: { attributes: { controls: true, preload: 'metadata', playsinline: true } },
  }),
  htmlBlock('audio', 'Audio', 'media', 'img', 'An HTML audio player with native controls.', {
    canHaveChild: true,
    options: { attributes: { controls: true, preload: 'metadata' } },
  }),
  htmlBlock('iframe', 'Embedded Content', 'media', 'layout', 'An isolated frame for embedding external content.', {
    options: {
      attributes: { src: 'about:blank', title: 'Embedded content', loading: 'lazy', width: '100%', height: '320' },
    },
  }),

  // Links & actions
  htmlBlock('a', 'Link', 'actions', 'link', 'A navigational link.', {
    content: 'Link text',
    options: { attributes: { href: '#' } },
  }),
  htmlBlock('button', 'Button', 'actions', 'rectangle-fill', 'An actionable button.', {
    content: 'Button',
    canHaveChild: true,
  }),
  htmlBlock('dialog', 'Dialog', 'actions', 'layout', 'A native dialog surface for modal or non-modal content.', {
    canHaveChild: true,
  }),
  htmlBlock('details', 'Disclosure', 'actions', 'layout', 'Expandable content using native disclosure behavior.', {
    canHaveChild: true,
  }),
  htmlBlock('summary', 'Disclosure Summary', 'actions', 'paragraph', 'The visible heading for a disclosure element.', {
    content: 'Show details',
    canHaveChild: true,
  }),

  // Forms
  htmlBlock('form', 'Form', 'forms', 'input', 'A form container for user input controls.', {
    canHaveChild: true,
    options: { attributes: { action: '#', method: 'get' } },
  }),
  htmlBlock('label', 'Label', 'forms', 'paragraph', 'An accessible label for a form control.', {
    content: 'Field label',
    canHaveChild: true,
    options: { attributes: { for: '' } },
  }),
  htmlBlock('fieldset', 'Fieldset', 'forms', 'input', 'Groups related form controls.', { canHaveChild: true }),
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
  }),
  htmlBlock('select', 'Select', 'forms', 'input', 'A dropdown selection control.', { canHaveChild: true }),
  htmlBlock('option', 'Select Option', 'forms', 'paragraph', 'An option inside a select control.', {
    content: 'Option',
    options: { attributes: { value: 'option' } },
  }),

  // Lists & data
  htmlBlock('ul', 'Unordered List', 'data', 'collection', 'A bulleted list.', { canHaveChild: true }),
  htmlBlock('ol', 'Ordered List', 'data', 'collection', 'A numbered list.', { canHaveChild: true }),
  htmlBlock('li', 'List Item', 'data', 'collection', 'An item inside an ordered or unordered list.', {
    content: 'List item',
    canHaveChild: true,
  }),
  htmlBlock('dl', 'Description List', 'data', 'collection', 'A list of terms and their descriptions.', {
    canHaveChild: true,
  }),
  htmlBlock('dt', 'Description Term', 'data', 'paragraph', 'A term in a description list.', { content: 'Term' }),
  htmlBlock('dd', 'Description Details', 'data', 'paragraph', 'A description for a term.', { content: 'Description' }),
  htmlBlock('table', 'Table', 'data', 'table', 'A semantic data table.', { canHaveChild: true }),
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
  }),
  htmlBlock('progress', 'Progress', 'data', 'collection', 'A native progress indicator.', {
    options: { attributes: { value: '60', max: '100' } },
  }),
  htmlBlock('meter', 'Meter', 'data', 'collection', 'A scalar measurement within a known range.', {
    options: { attributes: { value: '0.6', min: '0', max: '1' } },
  }),
  CollectionItemSource,
  HeroTableSource,

  // Print & page-specific
  PageBreakSource,
];
