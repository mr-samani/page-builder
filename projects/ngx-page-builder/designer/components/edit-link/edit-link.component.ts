import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CMSPage, LibConsts, PageItem } from 'ngx-page-builder/core';
import { InputGroupModule } from '../../controls/input-group/input-group.module';
import { SwitchComponent } from '../../controls/switch/switch.component';
import { SvgIconDirective } from '../../directives/svg-icon.directive';

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
  imports: [CommonModule, FormsModule, InputGroupModule, SvgIconDirective, SwitchComponent],
})
export class EditLinkComponent implements OnInit {
  @Input() item!: PageItem;

  type: LinkType = 'link';

  /** مقدار خام که user تایپ می‌کنه (بدون prefix مثل mailto:) */
  link = '';

  pages: CMSPage[] = LibConsts.cmsPages;

  openInNewWindow = false;
  isInvalid = false;

  constructor() {}

  ngOnInit(): void {
    // TODO: pages رو از service بگیر
    // this.pages = this.pageService.getAll();

    const href: string = this.item.options?.attributes?.['href'] ?? '';
    this.openInNewWindow = this.item.options?.attributes?.['target'] === '_blank';

    this._loadFromHref(href);
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
}
