import { SourceItem } from 'ngx-page-builder/core';

export const HeroTablePreview = new SourceItem({
  tag: 'hero-table',
  icon: 'assets/icons/table.svg',
  title: 'Hero Table',
  customComponent: {
    componentKey: 'NgxPgHeroTable',
    component: () => import('./hero-table.component').then((c) => c.PreviewHeroTableComponent),
  },
  css: `
  .ngx-hero-table{
    width: 100%;
    border-collapse: collapse;
    border: 1px #2196f3 solid;
  }
  .ngx-hero-table-thead {
    background-color: beige;
  }
  .ngx-hero-table-cell{
    min-width: 32px;
    min-height: 32px;
    padding: 8px 5px;
  }

  `,
});
