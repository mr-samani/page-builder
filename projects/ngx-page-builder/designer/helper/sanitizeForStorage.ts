import { ElementRef } from '@angular/core';

export function sanitizeForStorage(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForStorage);
  }

  if (typeof obj === 'object') {
    const clean: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // حذف چیزهای خطرناک
      if (
        value instanceof HTMLElement ||
        value instanceof ElementRef ||
        key.startsWith('__') ||
        key === 'directive' ||
        key === 'elementRef' ||
        key === 'nativeElement' ||
        key === 'parent'
      ) {
        continue;
      }

      clean[key] = sanitizeForStorage(value);
    }
    return clean;
  }

  return obj;
}
