import { inject, Injectable } from '@angular/core';
import { sanitizeForStorage } from '../../helper/sanitizeForStorage';

import { PageBuilderService } from '../page-builder.service';
import { NGX_PAGE_BUILDER_SNIPPET_STORE } from './snippet.token';
import { ISnippetStore } from './snippet.store';
import { preparePageItems } from '../../helper/prepare-page-builder-data';

import { IPageItem, IPaginationSnippet, ISnippet, PageItem, deepCloneInstance } from 'ngx-page-builder/core';
import { ClassManagerService } from '../class-manager.service';

/** شکل ذخیره‌شده‌ی داخل ISnippet.data */
interface SnippetPayload {
  /** درخت بلاک (استایل‌های اختصاصی هر بلاک داخل خود `css` ی هر node است) */
  sanitized: IPageItem;
  /** فقط استایل «کلاس‌های دستی» استفاده‌شده در درخت (کلاس‌های blk-* عمداً نیستند) */
  style?: string;
}

@Injectable()
export class PBSnippetService {
  private snippetStore = inject<ISnippetStore>(NGX_PAGE_BUILDER_SNIPPET_STORE);
  protected readonly pb = inject(PageBuilderService);

  constructor(private cls: ClassManagerService) {}

  async getSnippet(item: PageItem): Promise<ISnippet> {
    const { snapdom } = await import('@zumer/snapdom');
    if (!snapdom) {
      throw new Error('snapdom not exist. `npm i @zumer/snapdom`');
    }
    if (!item.el) {
      throw new Error('Can not get html element!');
    }

    const style = this.cls.getManualClassStyles(item);

    const img =
      (
        await snapdom.toPng(item.el, {
          embedFonts: true,
          backgroundColor: '#fff',
          outerShadows: true,
          fast: false,
          placeholders: true,
        })
      ).src ?? '';
    const clonedData = deepCloneInstance(item);
    const data = preparePageItems([clonedData])[0];
    const sanitized = sanitizeForStorage(data);

    const payload: SnippetPayload = { sanitized, style };
    return {
      image: img,
      name: '',
      data: JSON.stringify(payload),
    };
  }

  save(snippet: ISnippet) {
    return this.snippetStore.save(snippet);
  }

  getAllSnippets(take: number, skip: number, filter: string): Promise<IPaginationSnippet> {
    return this.snippetStore.getAllSnippets(take, skip, filter);
  }

  deleteSnippet(item: ISnippet, index: number): Promise<boolean> {
    return this.snippetStore.deleteSnippet(item, index);
  }

  /** یک کپی مستقل از snippet را به صفحه اضافه می‌کند (داخل بلاک انتخاب‌شده، یا انتهای صفحه) */
  async addToForm(snippet: ISnippet): Promise<void> {
    const raw = snippet.data;
    if (!raw) throw new Error('Snippet has no data');

    let parsed: SnippetPayload;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Snippet data is corrupted');
    }
    if (!parsed?.sanitized) throw new Error('Snippet data is corrupted');

    if (parsed.style) {
      await this.cls.addMissingClassStyles(parsed.style);
    }
    const added = await this.pb.addBlockToCurrentPage(parsed.sanitized);
    if (!added) throw new Error('Could not add snippet to the page');
  }
}
