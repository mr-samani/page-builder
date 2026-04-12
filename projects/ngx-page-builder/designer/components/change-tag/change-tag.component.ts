import { Component, inject, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DynamicElementService, PageItem } from 'ngx-page-builder/core';
import { PageBuilderService } from 'ngx-page-builder/designer';

@Component({
  selector: 'change-tag',
  templateUrl: './change-tag.component.html',
  styleUrls: ['./change-tag.component.scss'],
  imports: [FormsModule],
})
export class ChangeTagComponent implements OnInit {
  canChangeTag = false;
  item!: PageItem;
  @Input('item') set setItem(val: PageItem) {
    this.item = val;
    this.canChangeTag = this.tagList.indexOf(this.item.tag) > -1;
  }

  tagList = [
    'a',
    'area',
    'article',
    'aside',

    'b',

    'bdi',
    'bdo',
    'blockquote',

    'code',

    'div',

    'footer',

    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',

    'head',

    'label',

    'main',

    'p',

    'pre',

    's',
    'u',

    'section',

    'small',

    'span',
    'strong',
  ];
  protected pageBuilder = inject(PageBuilderService);
  protected dynamicElementService = inject(DynamicElementService);

  ngOnInit() {}

  async onChangeTag(ev: Event) {
    let tag: string = (ev.currentTarget as HTMLInputElement).value;
    if (!tag) {
      return;
    }
    debugger;
    let parentChildren = this.item.parent?.children;
    if (!parentChildren) {
      parentChildren = this.pageBuilder.findRootParentItem(this.item);
    }
    if (!this.item || !parentChildren) {
      throw new Error('Change block TagName failed: invalid parent item in list');
    }

    const index = parentChildren.findIndex((i: PageItem) => i.id === this.item.id);

    const el = await this.dynamicElementService.changeElementTagName(this.item, tag, index);
    this.pageBuilder.deSelectBlock();
    this.pageBuilder.selectBlock(this.item);
  }
}
