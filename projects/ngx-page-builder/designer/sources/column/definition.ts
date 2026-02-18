import { SourceItem } from 'ngx-page-builder/core';

export const ColumnSource = new SourceItem({
  tag: 'column',
  icon: 'assets/icons/column.svg',
  title: 'Column',
  canHaveChild: true,
  options: {
    inputs: {},
  },
  customComponent: {
    componentKey: 'NgxPgColumn',
    component: () => import('./column.component').then((c) => c.ColumnComponent),
  },
});
