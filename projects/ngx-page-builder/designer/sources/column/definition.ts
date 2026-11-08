import { SourceItem } from 'ngx-page-builder/core';

export const ColumnSource = new SourceItem({
  tag: 'column',
  icon: 'assets/icons/column.svg',
  title: 'Column',
  category: 'layout',
  description: 'A responsive column container for composing multi-column layouts.',
  canHaveChild: true,
  options: {
    inputs: {},
  },
  customComponent: {
    componentKey: 'NgxPgColumn',
    component: () => import('./column.component').then((c) => c.ColumnComponent),
  },
});
