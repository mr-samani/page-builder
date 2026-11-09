import { SourceItem } from 'ngx-page-builder/core';

export const ColumnPreview = new SourceItem({
  tag: 'column',
  icon: 'column',
  title: 'Column',
  options: {
    inputs: {},
  },
  customComponent: {
    componentKey: 'NgxPgColumn',
    component: () => import('./column.component').then((c) => c.PreviewColumnComponent),
  },
});
