import { PageItem } from 'ngx-page-builder/core';

export const WEB_BODY_BLOCK: PageItem = new PageItem({
  tag: 'body',
  canHaveChild: true,
  children: [],
  disableMovement: true,
});
