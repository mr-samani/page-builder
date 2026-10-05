import { InjectionToken } from '@angular/core';
import type { FontOption } from './typography-model';

/**
 * فونت‌های پروژه (مثلاً Vazirmatn یا Google Fonts لودشده) برای لیست فونت:
 * ```ts
 * providers: [{
 *   provide: NGX_PAGE_BUILDER_FONTS,
 *   useValue: [{ label: 'Vazirmatn', value: 'Vazirmatn, Tahoma, sans-serif', group: 'Project fonts' }],
 * }]
 * ```
 */
export const NGX_PAGE_BUILDER_FONTS = new InjectionToken<FontOption[]>('NGX_PAGE_BUILDER_FONTS');
