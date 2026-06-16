import { IPageItem, cloneDeep } from 'ngx-page-builder/core';

export const _th: IPageItem = {
  tag: 'th',
  disableDelete: true,
  disableMovement: true,
  lockMoveInnerChild: true,
  canHaveChild: true,
};

export const _td: IPageItem = {
  tag: 'td',
  disableDelete: true,
  disableMovement: true,
  lockMoveInnerChild: true,
  canHaveChild: true,
};

export const _headRow: IPageItem = {
  tag: 'tr',
  disableDelete: true,
  canHaveChild: false,
  lockMoveInnerChild: true,
  disableMovement: true,
  children: [cloneDeep(_th), cloneDeep(_th), cloneDeep(_th)],
};

export const _bodyRow: IPageItem = {
  tag: 'tr',
  disableDelete: true,
  canHaveChild: false,
  lockMoveInnerChild: true,
  disableMovement: true,
  children: [cloneDeep(_td), cloneDeep(_td), cloneDeep(_td)],
};

export const _template: IPageItem = {
  tag: 'table',
  isTemplateContainer: true,
  canHaveChild: true,
  disableMovement: true,
  lockMoveInnerChild: true,
  disableDelete: true,
  classList: [],
  css: ` 
    width: 100%;
    border-collapse: collapse;
    border: 1px #2196f3 solid;
    `,
  children: [
    {
      tag: 'thead',
      disableDelete: true,
      canHaveChild: false,
      lockMoveInnerChild: true,
      disableMovement: true,
      children: [cloneDeep(_headRow)],
      css: `
        background-color: beige;
        `,
    },
    {
      tag: 'tbody',
      disableDelete: true,
      canHaveChild: false,
      lockMoveInnerChild: true,
      disableMovement: true,
      children: [cloneDeep(_bodyRow)],
    },
    {
      tag: 'tfoot',
      disableDelete: true,
      canHaveChild: false,
      lockMoveInnerChild: true,
      disableMovement: true,
      children: [],
    },
  ],
};
