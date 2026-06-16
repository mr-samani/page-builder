import { ElementRef, Injectable, OnDestroy, Signal, signal } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { IDropEvent } from 'ngx-drag-drop-kit';
import { Notify } from '../extensions/notify';
import { BlockSelectorComponent } from '../components/block-selector/block-selector.component';
import { HistoryService } from './history.service';
import { IStorageService } from './storage/IStorageService';

import {
  DynamicDataService,
  DynamicElementService,
  IPageItem,
  LibConsts,
  LOCAL_STORAGE_SHOW_OUTLINE_KEY,
  Page,
  PageBuilderDto,
  PageItem,
  SourceItem,
} from 'ngx-page-builder/core';
import { getDefaultBlockClasses, getDefaultBlockDirective } from '../helper/getDefaultBlockDirective';
import { ClassManagerService } from '../services/class-manager.service';

export interface PageItemChange {
  item: PageItem | null;
  parent?: PageItem[];
  type:
    | 'ChangePageConfig'
    | 'AddBlock'
    | 'ChangeBlockContent'
    | 'ChangeBlockProperties'
    | 'RemoveBlock'
    | 'MoveBlock'
    | 'ChangeTagName'
    | 'ChangeClassName';
}

@Injectable({
  providedIn: 'root',
})
export class PageBuilderService implements OnDestroy {
  isSaving: boolean = false;
  sources: SourceItem[] = LibConsts.SourceItemList;
  innerShadowRootDom?: ShadowRoot | null;

  /** start from 0 */
  currentPageIndex = signal<number>(-1);
  activeEl = signal<PageItem | undefined>(undefined);
  pageBody: Signal<ElementRef<HTMLElement> | undefined> = signal<ElementRef<HTMLElement> | undefined>(undefined);
  pageHeader: Signal<ElementRef<HTMLElement> | undefined> = signal<ElementRef<HTMLElement> | undefined>(undefined);
  pageFooter: Signal<ElementRef<HTMLElement> | undefined> = signal<ElementRef<HTMLElement> | undefined>(undefined);
  showOutlines = signal(true);
  pageInfo = new PageBuilderDto();

  private _changed$ = new Subject<PageItemChange>();
  /** تغییر کردن pageitem ها */
  changed$ = this._changed$.asObservable();

  /** جابجایی بین صفحات */
  onPageChange$ = new BehaviorSubject<Page | undefined>(undefined);
  onSelectBlock$ = new BehaviorSubject<{ ev?: PointerEvent; item: PageItem } | undefined>(undefined);

  blockSelector?: BlockSelectorComponent;

  storageService!: IStorageService;

  copyStorage?: PageItem;
  constructor(
    private dynamicElementService: DynamicElementService,
    private dynamicDataService: DynamicDataService,
    private history: HistoryService,
    public cls: ClassManagerService,
  ) {
    const so = localStorage.getItem(LOCAL_STORAGE_SHOW_OUTLINE_KEY) || '';
    if (so != '') {
      this.showOutlines.set(so == 'true');
    }
  }

  ngOnDestroy(): void {
    this._changed$.complete();
    this.onPageChange$.unsubscribe();
    this.onSelectBlock$.unsubscribe();
    this.history.clear();
  }
  updateChangeDetection(data: PageItemChange) {
    this._changed$.next(data);
  }

  public get currentPage(): Page | undefined {
    return this.pageInfo.pages[this.currentPageIndex()];
  }
  public set currentPage(page: Page) {
    if (!this.pageInfo.pages[this.currentPageIndex()]) {
      throw new Error('Current page does not exist');
    }
    this.pageInfo.pages[this.currentPageIndex()] = page;
  }

  async onDrop(event: IDropEvent<PageItem[]>, parent?: PageItem) {
    console.log('Dropped:', event);
    const containerEl = event.container.el;
    const previousEl = event.previousContainer.el;
    if (!event.container.data || !event.previousContainer.data) {
      return;
    }
    if (containerEl == previousEl && event.currentIndex == event.previousIndex) {
      return;
    }
    const dragItem: PageItem = event.previousContainer.data[event.previousIndex];
    if (!dragItem) {
      console.warn('Block not found in previus container!');
      return;
    }

    this.activeEl.set(undefined);
    if (event.previousContainer.el.id == 'blockSourceList') {
      // انتقال از یک container به container دیگه
      const source = new PageItem(this.sources[event.previousIndex], parent);
      source.children = []; // very important to create reference to droplist data
      await this.createBlockElement(true, source, containerEl, event.currentIndex);

      event.container.data.splice(event.currentIndex, 0, source);
      this.selectBlock(source);
      this.updateChangeDetection({ item: source, parent: event.container.data, type: 'AddBlock' });

      this.history.saveAdd(parent?.id, event.currentIndex, source, `Add block'${source.id}' to '${parent?.id}'`);
    } else {
      // بررسی اجازه جابجایی در ایتم های کالکشن (لیست تکرار شونده)
      if (this.canMove(dragItem, event.container) == false) {
        Notify.warning('You cannot move this item here.');
        return;
      }

      await this.removeBlock(dragItem);
      dragItem.parent = parent;
      await this.createBlockElement(true, dragItem, containerEl, event.currentIndex);

      event.container.data.splice(event.currentIndex, 0, dragItem);

      this.updateChangeDetection({
        item: event.container.data[event.currentIndex],
        parent: event.container.data,
        type: 'MoveBlock',
      });

      this.history.saveMove(
        dragItem.id,
        dragItem.parent?.id,
        event.previousIndex,
        event.container.data[event.currentIndex]?.parent?.id,
        event.currentIndex,
        event.container.data[event.currentIndex],
        `Move block '${dragItem.id}' from: '${dragItem.parent?.id}' to: '${
          event.container.data[event.currentIndex]?.parent?.id
        }'`,
      );
    }
    // this.chdRef.detectChanges();
    this.onPageChange$.next(this.currentPage);
  }

  /**
   * in collection item list only can move element in inner self template
   * @param source current drag item
   * @param destination destination drop list
   * @returns boolean
   */
  private canMove(source: PageItem, destination: any): boolean {
    if (source.disableMovement) return false;
    let p = this.getParentTemplate(source);
    if (!p || !p.lockMoveInnerChild) return true;
    return destination.el.closest('.template-container') == p.el;
  }

  getParentTemplate(item: PageItem): PageItem | undefined {
    if (!item || !item.parent) return undefined;
    if (item.parent.isTemplateContainer) {
      return item.parent;
    }
    return this.getParentTemplate(item.parent);
  }

  async addPage(): Promise<number> {
    let index = this.currentPageIndex() + 1;
    this.pageInfo.pages.splice(index, 0, new Page());
    const c = await this.changePage(index + 1);
    return c;
  }

  async removePage(): Promise<number> {
    let index = this.currentPageIndex();
    if (index > -1) {
      this.cleanCanvas(index);
      this.pageInfo.pages.splice(index, 1);
      if (this.pageInfo.pages.length == 0) {
        return this.addPage();
      } else {
        if (index == 0) {
          index++;
        }
        return await this.changePage(index);
      }
    }
    throw Error('Invalid page index');
  }

  /**
   * clean all pages
   * @returns
   */
  async removeAllPages(): Promise<void> {
    try {
      this.deSelectBlock();
      for (let i = 0; i < this.pageInfo.pages.length; i++) {
        const sections = [
          ...this.pageInfo.pages[i].headerItems,
          ...this.pageInfo.pages[i].bodyItems,
          ...this.pageInfo.pages[i].footerItems,
        ];
        for (let index = 0; index < sections.length; index++) {
          await this.cleanCanvas(index);
        }
      }
      this.pageInfo.pages = [];
      return;
    } catch (error) {
      // console.error( error);
    }
  }

  async nextPage(): Promise<number> {
    let index = this.currentPageIndex();
    if (index < this.pageInfo.pages.length - 1) {
      return await this.changePage(index + 2);
    }
    throw Error('No next page');
  }
  async previousPage(): Promise<number> {
    let index = this.currentPageIndex();
    if (index > 0) {
      return await this.changePage(index);
    }
    throw Error('No previous page');
  }

  /**
   * Change the current page
   * @param pageNumber start from 1
   */
  async changePage(pageNumber: number): Promise<number> {
    try {
      this.deSelectBlock();
      if (pageNumber == undefined || pageNumber == null) {
        throw Error('Required page number');
      }
      if (pageNumber < 1 || pageNumber > this.pageInfo.pages.length) {
        throw Error('Invalid page number');
      } else {
        this.cleanCanvas(this.currentPageIndex());
        const { headerItems, bodyItems, footerItems } = this.pageInfo.pages[pageNumber - 1];
        await this.genElms(bodyItems, this.pageBody()!.nativeElement);
        if (LibConsts.viewMode == 'PrintPage') {
          await this.genElms(headerItems, this.pageHeader()!.nativeElement);
          await this.genElms(footerItems, this.pageFooter()!.nativeElement);
        }
        this.currentPageIndex.set(pageNumber - 1);
        this.onPageChange$.next(this.pageInfo.pages[this.currentPageIndex()]);
        return this.currentPageIndex();
      }
    } catch (error) {
      console.error('Error changing page:', error);
      throw Error('Error changing page');
    }
  }

  /**
   * update current page body blocks
   * @param blocks body blocks
   * @returns
   */
  async updatePage(blocks: PageItem[]): Promise<void> {
    try {
      if (!this.currentPage) {
        Notify.error('Page Not Exist!');
        throw Error('Page Not Exist!');
      }
      this.currentPage.bodyItems = blocks;
      await this.changePage(this.currentPageIndex() + 1);
    } catch (error) {
      console.error('Error updating page:', error);
      throw Error('Error updating page');
    }
  }

  private async genElms(list: PageItem[], container: HTMLElement, index = -1) {
    for (let i = 0; i < list.length; i++) {
      list[i].el = await this.createBlockElement(true, list[i], container, index);
    }
  }
  async reloadCurrentPage() {
    await this.changePage(this.currentPageIndex() + 1);
  }

  /**
   *  ایجاد المنت جدید حتما باید با await انجام شود
   */
  async createBlockElement(editMode: boolean, item: PageItem, container?: HTMLElement | null, index: number = -1) {
    if (!container) {
      container = this.pageBody()?.nativeElement;
    }
    if (!container) {
      throw new Error('Required container to create element');
    }
    if (editMode) {
      item.options ??= {};
      item.options.directives ??= [];
      item.options.directives = await getDefaultBlockDirective(item, (ev: IDropEvent<PageItem[]>) => {
        this.onDrop(ev, item);
      });

      if (item.options.directives.length >= 4) {
        throw new Error('Too many directives');
      }
      item.options.attributes ??= {};
      const classNames = getDefaultBlockClasses(item);
      item.options.attributes['class'] ??= classNames;
      if (!item.options.attributes['class'].includes(classNames)) {
        item.options.attributes['class'] += ` ${classNames}`;
      }
      item.options.events ??= {};
      item.options.events['click'] = (ev: PointerEvent) => this.selectBlock(item, ev);
    }

    if (item.css) {
      this.cls.addBlockCss(item);
    }

    let el = await this.dynamicElementService.createBlock(LibConsts.SourceItemList, editMode, container, index, item);
    if (!item.customComponent && item.children && item.children.length > 0 && el) {
      for (const child of item.children) {
        await this.createBlockElement(editMode, child, el, -1);
      }
    }
    return el;
  }

  /**
   * Clean the canvas by removing all elements
   * - and destroy directives
   * @returns void
   */
  private cleanCanvas(pageIndex: number) {
    this.deSelectBlock();
    const page = this.pageInfo.pages[pageIndex];
    if (!page) return;
    this.dynamicElementService.destroyBatch(page.bodyItems);
    this.dynamicElementService.destroyBatch(page.headerItems);
    this.dynamicElementService.destroyBatch(page.footerItems);
    this.pageBody()!.nativeElement.innerHTML = '';
    if (LibConsts.viewMode == 'PrintPage') {
      this.pageHeader()!.nativeElement.innerHTML = '';
      this.pageFooter()!.nativeElement.innerHTML = '';
    }
  }

  selectBlock(c: PageItem, ev?: PointerEvent) {
    // console.log('click on block', c.el);
    ev?.stopPropagation();
    ev?.preventDefault();
    this.activeEl.set(c);
    this.onSelectBlock$.next({ ev: ev, item: c });
  }
  deSelectBlock() {
    this.activeEl.set(undefined);
    this.onSelectBlock$.next(undefined);
  }

  /**
   * return parent root bodyItems|headerItems|footerItems
   * @param item block
   * @returns parent root
   */
  findRootParentItem(item: PageItem) {
    const page = this.pageInfo.pages[this.currentPageIndex()];
    for (let p of page.headerItems) if (p.id == item.id) return page.headerItems;
    for (let p of page.bodyItems) if (p.id == item.id) return page.bodyItems;
    for (let p of page.footerItems) if (p.id == item.id) return page.footerItems;
    return undefined;
  }

  // TODO: clear css class on delete tree
  async removeBlock(item: PageItem) {
    if (!item || item.disableDelete) return;

    let parentChildren = item.parent?.children;
    if (!parentChildren) {
      parentChildren = this.findRootParentItem(item);
    }
    if (!item || !parentChildren) {
      throw new Error('Remove block failed: invalid parent item in list');
    }

    const index = parentChildren.findIndex((i: PageItem) => i.id === item.id);
    if (index !== -1 && item.el) {
      parentChildren.splice(index, 1);
      await this.dynamicElementService.destroy(item);
    }
    this.activeEl.set(undefined);
    this.updateChangeDetection({ item: item, parent: parentChildren, type: 'RemoveBlock' });

    this.history.saveDelete(item.parent?.id, index, item, `Delete block '${item.id}' from '${item.parent?.id}'`);
  }

  writeItemValue(data: PageItem) {
    this.dynamicElementService.updateElementContent(data);
    this.updateChangeDetection({ item: data, type: 'ChangeBlockContent' });
  }
  changedProperties(item: PageItem) {
    if (item.el) {
      // item.style = item.el.style.cssText;
      // item.style = encodeURIComponent(item.el.style.cssText);
      if (item.content && item.content != item.el.textContent) {
        item.el.textContent = item.content;
        // item.el.textContent = this.dynamicDataService.replaceContentValue(item.content);
      }
    }
    this.updateChangeDetection({ item: item, type: 'ChangeBlockProperties' });

    // TODO: required previouws snapshot
    this.history.saveEdit(item.id, item, item, `Change properties '${item.id}': '${item.el?.style?.cssText}'`);
  }

  save() {
    this.isSaving = true;
    this.storageService
      .saveData()
      .then((result) => {
        console.log('Data saved successfully:', result);
        Notify.success('Data saved successfully');
      })
      .finally(() => (this.isSaving = false));
  }

  async open() {
    return new Promise((resolve, reject) => {
      this.deSelectBlock();
      this.storageService
        .loadData()
        .then(async (data) => {
          await this.removeAllPages();
          this.pageInfo = PageBuilderDto.fromJSON({ config: data.config, pages: data.data });
          console.log(this.pageInfo.pages.length);
          if (this.pageInfo.pages.length == 0) {
            this.addPage();
          } else {
            await this.changePage(1);
          }
          resolve(true);
        })
        .catch((error) => {
          Notify.error(error);
          reject(error);
        });
    });
  }

  redo() {
    throw new Error('Method not implemented.');
  }
  undo() {
    throw new Error('Method not implemented.');
  }
  duplicateBlock(currentBlock: PageItem) {
    throw new Error('Method not implemented.');
  }
  async pasteBlock() {
    if (!this.activeEl() || !this.copyStorage || !this.activeEl()?.el) {
      return;
    }
    await this.addBlockToCurrentPage(this.copyStorage);
  }
  copyBlock(currentBlock: PageItem) {
    this.copyStorage = Object.assign({}, currentBlock);
    Notify.info('Block copied to memory');
  }

  async addBlockToCurrentPage(p: IPageItem) {
    let item = PageItem.fromJSON(p);
    let activeBlock = this.activeEl();

    if (!this.currentPage) {
      await this.addPage();
    }
    if (activeBlock) {
      item.parent = activeBlock;
      activeBlock.children.push(item);
    } else {
      if (!this.pageInfo.pages[this.currentPageIndex()]) {
        Notify.error('Page Not Exist!');
        return;
      }

      this.pageInfo.pages[this.currentPageIndex()].bodyItems.push(item);
    }
    await this.createBlockElement(true, item, activeBlock?.el);
    this.selectBlock(item);
    Notify.success('Add successfully');
  }
}
