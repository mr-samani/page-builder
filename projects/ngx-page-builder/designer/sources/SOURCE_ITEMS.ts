import { CollectionItemSource } from './collection-item/definition';
import { HeroTableSource } from './hero-table/definition';
import { PageBreakSource } from './page-break/definition';
import { ColumnSource } from './column/definition';
import { SourceItem, randomNumber } from 'ngx-page-builder/core';

export const SOURCE_ITEMS: SourceItem[] = [
  {
    tag: 'div',
    title: 'Div',
    icon: 'assets/icons/div.svg',
    canHaveChild: true,
  },
  {
    tag: 'section',
    title: 'Section',
    icon: 'assets/icons/section.svg',
    canHaveChild: true,
  },
  {
    tag: 'span',
    title: 'Span',
    icon: 'assets/icons/span.svg',
    content: 'Span',
  },
  {
    tag: 'p',
    title: 'Paragraph',
    icon: 'assets/icons/paragraph.svg',
    content: 'Paragraph',
  },
  {
    tag: 'h1',
    title: 'Heading',
    icon: 'assets/icons/h.svg',
    content: 'Heading',
  },
  {
    tag: 'img',
    title: 'Image',
    icon: 'assets/icons/img.svg',
    options: {
      attributes: {
        loading: 'lazy',
      },
    },
    classList: ['img'],
  },
  {
    tag: 'a',
    title: 'Link',
    icon: 'assets/icons/link.svg',
    content: 'hyper link',
    canHaveChild: true,
  },
  {
    tag: 'input',
    title: 'Input',
    icon: 'assets/icons/input.svg',
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
    icon: 'assets/icons/rectangle-fill.svg',
    content: 'Button',
  },
  ColumnSource,
  PageBreakSource,
  CollectionItemSource,
  HeroTableSource,
];
