import { ISourceOptions, SourceItem } from './SourceItem';
import { CustomComponent } from './CustomComponent';
import { DataSourceSetting } from './DataSourceSetting';
import { IPageItem } from '../contracts/IPageItem';
import { randomStrnig } from '../utiles/generateUUID';
import { cloneDeep } from '../utiles/clone-deep';

export class PageItem implements IPageItem {
  id: string = '';
  dataSource?: DataSourceSetting;
  parent?: PageItem;
  el?: HTMLElement;
  children: PageItem[] = [];
  tag!: string;
  canHaveChild: boolean = false;
  /** content in html editor */
  content?: string;
  options?: ISourceOptions;

  /**
   * Disable movement of the source item
   * @example pagebreak cannot move to child items
   */
  disableMovement?: boolean = false;
  /**
   * disable move inner child item to outside of self list
   * @example prevent dragging child item of Item-Collection to another list
   */
  lockMoveInnerChild?: boolean = false;
  disableDelete?: boolean = false;
  isTemplateContainer?: boolean | undefined;
  //------------------------CUSTOM COMPONENT---------------------------
  /** custom component */
  customComponent?: CustomComponent;

  //---------------------------------------------------

  /**
   * item template collection
   * - NOTE: when pageItem has template, its children will be ignored on save.
   */
  template?: PageItem;

  classList: string[] = [];

  /** like .class{color:white;} */
  css?: string;

  constructor(data?: IPageItem, parent?: PageItem) {
    if (data) {
      for (var property in data) {
        if (property == 'children' || property == 'template') continue;
        if (this.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
      if (data.children) {
        this.children = data.children.map((child) => new PageItem(child, this));
      }
      if (data.template) {
        this.template = new PageItem(data.template, this);
      }
    }
    if (!this.id) this.id = randomStrnig(5);
    if (parent) this.parent = parent;
    this.classList ??= [];

    if (this.classList.length == 0) {
      this.classList.push(this.tag + '-' + this.id);
    }
  }
  static fromJSON(data: IPageItem): PageItem {
    const item = new PageItem(data);
    return item;
  }

  /**
   * @readonly
   */
  public get CanBeSetContent(): boolean {
    const isComponent = this.customComponent && typeof this.customComponent.component === 'function';
    return !(this.el?.tagName === 'IMG' || isComponent === true);
  }

  /**
   * @readonly
   */
  public get isImageTag(): boolean {
    return this.el?.tagName === 'IMG';
  }

  public get isLink(): boolean {
    return this.el?.tagName === 'A';
  }

  public static isImage(item: PageItem): boolean {
    return item.tag.toLowerCase() === 'img';
  }

  /**
   * Save element attribute
   * @param name attr
   * @param value value
   */
  public setItemAttribute(name: string, value: string) {
    if (!this.options) {
      this.options = {};
    }
    if (!this.options.attributes) {
      this.options.attributes = {};
    }
    this.options.attributes[name] = value;
  }

  public async getComponentInstance(sourceItemList: SourceItem[]) {
    if (this.customComponent && this.customComponent.componentKey) {
      const finded = sourceItemList.find((x) => x.customComponent?.componentKey === this.customComponent!.componentKey);
      if (finded) {
        this.customComponent = { ...this.customComponent, ...finded.customComponent! };
        return await this.customComponent.component();
      } else {
        console.error(`Custom component with key ${this.customComponent.componentKey} not found in CustomSources.`);
      }
    }
    return undefined;
  }

  public clone(parent?: PageItem): PageItem {
    let item = PageItem.fromJSON(cloneDeep(this));
    item.id = randomStrnig(5);
    delete item.options?.events;
    delete item.options?.directives;
    delete item.options?.inputs;
    delete item.options?.outputs;
    item.parent = parent;

    if (item.children && item.children.length > 0) {
      item.children = item.children.map((m) => m.clone(item));
    }
    return item;
  }
}
