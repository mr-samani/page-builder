import { sanitizeForStorage } from './sanitizeForStorage';
import { PageBuilderService } from '../page-builder.service';

import {
  IPageBuilderDto,
  IPagebuilderOutput,
  ISourceOptions,
  Page,
  PageBuilderConfig,
  PageBuilderDto,
  PageItem,
  deepCloneInstance,
} from 'ngx-page-builder/core';
import { ClassManagerService } from '../class-manager.service';

export function preparePageDataForSave(
  pageBuilder: PageBuilderService
): Promise<IPagebuilderOutput> {
  const pageInfo: PageBuilderDto = pageBuilder.pageInfo;
  const cls: ClassManagerService = pageBuilder.cls;
  return new Promise(async (resolve, reject) => {
    try {
      if (!pageInfo) {
        resolve({
          config: new PageBuilderConfig(),
          data: [],
          styles: [],
          html: '',
          script: '',
        });
        return;
      }

      //dont use cloneDeep(pageInfo) has error on clone object complex;
      const clone = deepCloneInstance(pageInfo, { cloneDom: false });
      const clonedData = PageBuilderDto.fromJSON(clone);

      for (let page of clonedData.pages) {
        const list = [...page.headerItems, ...page.bodyItems, ...page.footerItems];
        preparePageItems(list);
      }

      clonedData.pages.map((m: Page, index: number) => (m.order = index));

      const sanitized: IPageBuilderDto = sanitizeForStorage(clonedData);
      const styles = await cls.exportAllFileCSS();
      return resolve({
        config: sanitized.config,
        data: sanitized.pages,
        styles,
      });
    } catch (error) {
      reject(error);
    }
  });
}

export function preparePageItems(list: PageItem[]) {
  for (let item of list) {
    if (item.customComponent) {
      delete (item.customComponent as any).component;
      delete item.customComponent.componentSettings;
      delete item.customComponent.providers;
      delete item.customComponent.compInjector;
      // dont delete customComponent
      // delete item.customComponent;
    }

    // dont delete dataSource
    // delete item.dataSource;
    delete item.disableDelete;
    delete item.disableMovement;
    delete item.isTemplateContainer;
    delete item.lockMoveInnerChild;

    if (item.template) {
      item.children = [];
    }

    cleanAttributes(item.options);
    delete item.options?.events;
    delete item.options?.directives;
    delete item.el;

    if (item.children && item.children.length > 0) {
      item.children = preparePageItems(item.children);
    }
    if (item.template) {
      item.template = preparePageItems([item.template])[0];
    }
  }
  return list;
}

function removeClassesFromHtml(
  html: string,
  classesToRemove: string[],
  attributesToRemove: string[]
): string {
  if (!html) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const allElements = doc.body.querySelectorAll('*');

  for (const el of Array.from(allElements)) {
    classesToRemove.forEach((cls) => {
      if (el.classList.contains(cls)) el.classList.remove(cls);
    });
    if (el.classList.length === 0) el.removeAttribute('class');
    attributesToRemove.forEach((attr) => {
      if (el.hasAttribute(attr)) el.removeAttribute(attr);
    });
  }

  return doc.body.innerHTML.trim();
}

function cleanAttributes(opt?: ISourceOptions) {
  if (!opt || !opt.attributes) return;
  // clean up class
  if (typeof opt.attributes['class'] == 'string') {
    const filterdClasses = ['block-item'];
    opt.attributes['class'] = opt.attributes['class']
      .split(' ')
      .map((m: string) => m.trim())
      .filter((x: string) => filterdClasses.indexOf(x.toLowerCase()) === -1)
      .join(' ');
  }
}
