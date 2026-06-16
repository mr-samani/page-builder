import { SourceItem } from 'ngx-page-builder/core';

export const CollectionItemPreview = new SourceItem({
  tag: 'collection',
  icon: 'assets/icons/collection.svg',
  title: 'Collection Item',
  classList: [],
  css: `
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
    align-items: center;
    justify-content: center;
    padding: 10px;`,
  customComponent: {
    componentKey: 'NgxPgCollectionItem',
    component: () => import('./collection-item.component').then((c) => c.PreviewCollectionItemComponent),
  },
});
