import { CollectionItemSource } from './collection-item/definition';
import { HeroTableSource } from './hero-table/definition';
import { PageBreakSource } from './page-break/definition';
import { ColumnSource } from './column/definition';
import { SourceItem, randomNumber } from "ngx-page-builder/core";

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
    title: 'Heading 1',
    icon: 'assets/icons/h1.svg',
    content: 'Heading 1',
  },
  {
    tag: 'h2',
    title: 'Heading 2',
    icon: 'assets/icons/h2.svg',
    content: 'Heading 2',
  },
  {
    tag: 'h3',
    title: 'Heading 3',
    icon: 'assets/icons/h3.svg',
    content: 'Heading 3',
  },
  {
    tag: 'h4',
    title: 'Heading 4',
    icon: 'assets/icons/h4.svg',
    content: 'Heading 4',
  },
  {
    tag: 'h5',
    title: 'Heading 5',
    icon: 'assets/icons/h5.svg',
    content: 'Heading 5',
  },
  {
    tag: 'h6',
    title: 'Heading 6',
    icon: 'assets/icons/h6.svg',
    content: 'Heading 6',
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
