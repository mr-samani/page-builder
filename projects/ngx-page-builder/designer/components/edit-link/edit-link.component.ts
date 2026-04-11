import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CMSPage,
  CMSPageQueryString,
  DataSourceSetting,
  DynamicDataStructure,
  LibConsts,
  PageItem,
} from 'ngx-page-builder/core';
import { InputGroupModule } from '../../controls/input-group/input-group.module';
import { SwitchComponent } from '../../controls/switch/switch.component';
import { SvgIconDirective } from '../../directives/svg-icon.directive';
import { DataSourceSelectorComponent } from '../text-binding/data-source-selector/data-source-selector.component';

type LinkType = 'link' | 'page' | 'phone' | 'email';

// prefix هر type که در href ذخیره می‌شه
const PREFIX: Record<Exclude<LinkType, 'link' | 'page'>, string> = {
  email: 'mailto:',
  phone: 'tel:',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[\d\s\-().]{7,20}$/;
const URL_REGEX = /^(https?:\/\/)[\w\-]+(\.[\w\-]+)+[/#?]?.*$/;

@Component({
  selector: 'edit-link',
  templateUrl: './edit-link.component.html',
  styleUrls: ['./edit-link.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    InputGroupModule,
    SvgIconDirective,
    SwitchComponent,
    DataSourceSelectorComponent,
  ],
})
export class EditLinkComponent implements OnInit {
  @Input() item!: PageItem;
  @Input() parentCollection?: PageItem;
  @Input() collectionDsList: DynamicDataStructure[] = [];

  type: LinkType = 'link';

  /** مقدار خام که user تایپ می‌کنه (بدون prefix مثل mailto:) */
  link = '';

  pages: CMSPage[] = LibConsts.cmsPages;

  openInNewWindow = false;
  isInvalid = false;

  queryString: CMSPageQueryString[] = [];

  constructor() {}

  ngOnInit(): void {
    // TODO: pages رو از service بگیر
    // this.pages = this.pageService.getAll();

    let href: string = this.item.options?.attributes?.['href'] ?? '';
    this.openInNewWindow = this.item.options?.attributes?.['target'] === '_blank';

    if (Array.isArray(this.item?.options?.customData?.queryString)) {
      this.queryString = this.item.options.customData.queryString;
    }
    // check link has query string

    href = this.extractQueryString(href);

    this._loadFromHref(href);
  }

  private extractQueryString(href: string): string {
    let pos = href.indexOf('?');
    if (pos > 0) {
      let q = href.substring(pos + 1);
      let list = q.split('&');
      for (let l of list) {
        let p = l.split('=');
        if (this.queryString.findIndex((x) => x.key == p[0]) == -1) {
          this.queryString.push({ key: p[0], value: p[1] });
        }
      }

      return href.substring(0, pos);
    } else {
      return href;
    }
  }
  // ─── Type detection ─────────────────────────────────────────────
  private _loadFromHref(href: string): void {
    if (!href) {
      this.type = 'link';
      this.link = '';
      return;
    }

    if (href.startsWith('mailto:')) {
      this.type = 'email';
      this.link = href.slice('mailto:'.length);
    } else if (href.startsWith('tel:')) {
      this.type = 'phone';
      this.link = href.slice('tel:'.length);
    } else if (this.pages.some((p) => p.slag === href)) {
      this.type = 'page';
      this.link = href;
    } else {
      this.type = 'link';
      this.link = href;
    }
  }

  onTypeChange(): void {
    // وقتی type عوض می‌شه، مقدار قبلی را reset کن تا کاربر از نو وارد کنه
    this.link = '';
    this.isInvalid = false;
  }

  // ─── Save ────────────────────────────────────────────────────────

  onChange(): void {
    // if (!this.validate()) return;

    this.item.options ??= {};
    this.item.options.attributes ??= {};
    this.item.options.attributes['href'] = this._buildHref();
    this.item.options.attributes['target'] = this.openInNewWindow ? '_blank' : '';

    this.item.options.customData ??= {};
    this.item.options.customData['queryString'] = this.queryString.filter((x) => x.key);
  }

  private _buildHref(): string {
    switch (this.type) {
      case 'email':
        return `mailto:${this.link.trim()}`;
      case 'phone':
        return `tel:${this.link.trim()}`;
      default:
        return this.link.trim(); // link & page همان‌طور ذخیره می‌شن
    }
  }

  // ─── Validation ──────────────────────────────────────────────────

  validate(): boolean {
    const val = this.link.trim();

    if (!val) {
      this.isInvalid = true;
      return false;
    }

    switch (this.type) {
      case 'email':
        this.isInvalid = !EMAIL_REGEX.test(val);
        break;
      case 'phone':
        this.isInvalid = !PHONE_REGEX.test(val);
        break;
      case 'link':
        this.isInvalid = !URL_REGEX.test(val);
        break;
      case 'page':
        this.isInvalid = !this.pages.some((p) => p.slag === val);
        break;
    }

    return !this.isInvalid;
  }

  onChangeCollectionKey(event: string[], q: CMSPageQueryString) {
    q.value = `${event.join('.')}`;
    this.onChange();
  }

  addNewRecordQueryString() {
    this.queryString.push({ key: '', value: '', isDynamic: false });
  }
  removeQueryString(index: number) {
    this.queryString.splice(index, 1);
    this.onChange();
  }

  onChangePage() {
    let p = this.pages.find((x) => x.slag == this.link);
    if (p?.queryString) {
      for (let q of p.queryString) {
        if (this.queryString.findIndex((x) => x.key == q.key) == -1) {
          this.queryString.push(q);
        }
      }
    }
    this.onChange();
  }
}
