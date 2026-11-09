import { SourceItem } from 'ngx-page-builder/core';

export const HeroTableSource = new SourceItem({
  tag: 'hero-table',
  icon: 'table',
  title: 'Hero Table',
  category: 'data',
  description: 'An advanced data table with configurable columns and rows.',
  canHaveChild: true,
  customComponent: {
    componentKey: 'NgxPgHeroTable',
    component: () => import('./hero-table.component').then((c) => c.HeroTableComponent),
    componentSettings: () =>
      import('./table-settings/table-settings.component').then((c) => c.HeroTableSettingsComponent),
  },
});
