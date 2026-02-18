import { SourceItem } from 'ngx-page-builder/core';

export const PageBreakSource = new SourceItem({
  tag: 'page-break',
  icon: 'assets/icons/page-break.svg',
  title: 'Page Break',
  disableMovement: true,
  customComponent: {
    componentKey: 'NgxPgPageBreak',
    component: () => import('./page-break.component').then((c) => c.PageBreakComponent),
  },
});
