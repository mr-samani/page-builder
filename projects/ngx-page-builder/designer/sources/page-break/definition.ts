import { SourceItem } from 'ngx-page-builder/core';

export const PageBreakSource = new SourceItem({
  tag: 'page-break',
  icon: 'pageBreak',
  title: 'Page Break',
  category: 'document',
  description: 'Starts a new printed page in print layouts.',
  disableMovement: true,
  customComponent: {
    componentKey: 'NgxPgPageBreak',
    component: () => import('./page-break.component').then((c) => c.PageBreakComponent),
  },
});
