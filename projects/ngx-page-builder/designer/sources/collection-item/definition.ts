import { SourceItem } from 'ngx-page-builder/core';

export const CollectionItemSource = new SourceItem({
  tag: 'collection',
  icon: 'ollection',
  title: 'Collection Item',
  category: 'data',
  description: 'A repeatable item rendered from a collection data source.',
  classList: [],
  canHaveChild: false,
  css: {
    base: `
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
    align-items: center;
    justify-content: center;
    padding: 10px;
  `,
  },
  customComponent: {
    componentKey: 'NgxPgCollectionItem',
    component: () => import('./collection-item.component').then((c) => c.CollectionItemComponent),
    componentSettings: () =>
      import('./collection-settings/collection-settings.component').then((c) => c.CollectionSettingsComponent),
  },
});
