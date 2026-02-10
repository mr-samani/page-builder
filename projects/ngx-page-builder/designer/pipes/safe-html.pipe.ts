import { inject, Pipe } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'safeHtml',
})
export class SafeHtmlPipe {
  private readonly sanitizer = inject(DomSanitizer);
  transform(value?: string): SafeHtml {
    if (!value) value = '';
    return this.sanitizer.bypassSecurityTrustHtml(value);
  }
}
