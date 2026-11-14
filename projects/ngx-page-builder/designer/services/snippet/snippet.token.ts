import { InjectionToken } from '@angular/core';
import type { ISnippetStore } from './snippet.store';

export const NGX_PAGE_BUILDER_SNIPPET_STORE = new InjectionToken<ISnippetStore>('SnippetStore');
