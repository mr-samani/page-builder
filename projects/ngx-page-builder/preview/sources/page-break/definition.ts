import { SourceItem } from 'ngx-page-builder/core';

export const PageBreakPreview = new SourceItem({
  tag: 'page-break',
  icon: 'pageBreak',
  title: 'Page Break',
  disableMovement: true,
  customComponent: {
    componentKey: 'NgxPgPageBreak',
    component: () => import('./page-break.component').then((c) => c.PreviewPageBreakComponent),
  },
});
