import { inject, Pipe, type PipeTransform } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Pipe({
  name: 'sanitize',
})
export class HtmlSanitizer implements PipeTransform {
  protected readonly sanitizer = inject(DomSanitizer);
  transform(value: any, ...args: any[]) {
    return this.sanitizer.bypassSecurityTrustHtml(value);
  }
}
