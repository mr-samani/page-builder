import { CollectionItemPreview } from './collection-item/definition';
import { HeroTablePreview } from './hero-table/definition';
import { PageBreakPreview } from './page-break/definition';
import { ColumnPreview } from './column/definition';
import { SourceItem, randomNumber } from 'ngx-page-builder/core';

export const PREVIEW_SOURCE_ITEMS: SourceItem[] = [
  {
    tag: 'div',
    title: 'Div',
    icon: 'div',
    canHaveChild: true,
  },
  {
    tag: 'section',
    title: 'Section',
    icon: 'section',
    canHaveChild: true,
  },
  {
    tag: 'span',
    title: 'Span',
    icon: 'span',
    content: 'Span',
  },
  {
    tag: 'p',
    title: 'Paragraph',
    icon: 'paragraph',
    content: 'Paragraph',
  },
  {
    tag: 'h1',
    title: 'Heading',
    icon: 'h',
    content: 'Heading',
  },
  {
    tag: 'img',
    title: 'Image',
    icon: 'img',
    options: {
      attributes: {
        loading: 'lazy',
      },
    },
    classList: ['img'],
  },
  {
    tag: 'input',
    title: 'Input',
    icon: 'input',
    options: {
      attributes: {
        name: 'input-field-' + randomNumber(3),
        type: 'text',
        placeholder: 'Enter text',
      },
    },
  },
  {
    tag: 'button',
    title: 'Button',
    icon: 'rectangle-fill',
    content: 'Button',
  },
  ColumnPreview,
  PageBreakPreview,
  CollectionItemPreview,
  HeroTablePreview,
];
