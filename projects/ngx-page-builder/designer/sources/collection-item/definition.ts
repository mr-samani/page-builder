import { SourceItem } from 'ngx-page-builder/core';

export const CollectionItemSource = new SourceItem({
  tag: 'collection',
  icon: 'assets/icons/collection.svg',
  title: 'Collection Item',
  classList: ['collection-container'],
  canHaveChild: true,
  css: `
  .collection-container{
    display: flex;
    align-items: center;
    flex-wrap: wrap;
  }
  .card-collection {
    position: relative;
    flex: auto;
    box-shadow: 0 0px 4px rgba(0, 0, 0, 0.3);
    padding: 10px;
    border-radius: 5px;
    overflow: hidden;
    min-height: 120px;
    min-width: 100px;
  }`,
  customComponent: {
    componentKey: 'NgxPgCollectionItem',
    component: () => import('./collection-item.component').then((c) => c.CollectionItemComponent),
    componentSettings: () =>
      import('./collection-settings/collection-settings.component').then((c) => c.CollectionSettingsComponent),
  },
});
