import { SourceItem } from 'ngx-page-builder/core';

export const CollectionItemSource = new SourceItem({
  tag: 'collection',
  icon: 'assets/icons/collection.svg',
  title: 'Collection Item',
  classList: [],
  canHaveChild: false,
  css: `
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
    align-items: center;
    justify-content: center;
    padding: 10px;
  `,
  customComponent: {
    componentKey: 'NgxPgCollectionItem',
    component: () => import('./collection-item.component').then((c) => c.CollectionItemComponent),
    componentSettings: () =>
      import('./collection-settings/collection-settings.component').then((c) => c.CollectionSettingsComponent),
  },
});
