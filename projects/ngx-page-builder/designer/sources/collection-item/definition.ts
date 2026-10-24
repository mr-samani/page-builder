import { SourceItem, type IPageItem } from 'ngx-page-builder/core';

export const CollectionTemplate: IPageItem = {
  tag: 'article',
  isTemplateContainer: true,
  canHaveChild: true,
  disableMovement: true,
  lockMoveInnerChild: true,
  disableDelete: true,
  classList: [],
  children: [],
  css: {
    base: `
        position: relative;
        flex: auto;
        box-shadow: 0 0px 4px rgba(0, 0, 0, 0.3);
        padding: 10px;
        border-radius: 5px;
        overflow: hidden;
        min-height: 220px;
        min-width: 150px;
    `,
  },
};

export const CollectionItemSource = new SourceItem({
  tag: 'collection',
  icon: 'assets/icons/collection.svg',
  title: 'Collection Item',
  classList: [],
  canHaveChild: true,
  css: {
    base: `
    display: flex;
    flex-wrap: wrap;
    gap: 15px;
    align-items: center;
    justify-content: center;
    padding: 10px;
    min-height:100px;
  `,
  },
  customComponent: {
    componentKey: 'NgxPgCollectionItem',
    component: () => import('./collection-item.component').then((c) => c.CollectionItemComponent),
    componentSettings: () =>
      import('./collection-settings/collection-settings.component').then((c) => c.CollectionSettingsComponent),
  },
});
