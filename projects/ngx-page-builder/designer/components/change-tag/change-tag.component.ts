import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DynamicElementService, PageItem } from 'ngx-page-builder/core';

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
    'abbr',
    'address',
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

    'picture',
    'pre',

    's',

    'section',

    'small',

    'span',
    'strong',
  ];

  constructor(private dynamicElementService: DynamicElementService) {}

  ngOnInit() {}

  onChangeTag(ev: Event) {
    let tag: string = (ev.currentTarget as HTMLInputElement).value;
    if (!tag) {
      return;
    }
    const el = this.dynamicElementService.changeElementTagName(this.item, tag);
  }
}
