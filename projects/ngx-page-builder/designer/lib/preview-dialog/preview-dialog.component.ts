import {
  AfterViewInit,
  ApplicationRef,
  Component,
  createComponent,
  ElementRef,
  importProvidersFrom,
  inject,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { DynamicDataStructure, IPagebuilderOutput, LibConsts, ViewMode } from 'ngx-page-builder/core';
import { createApplication } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { NgxPagePreviewComponent, providePagePreview } from 'ngx-page-builder/preview';
import { DIALOG_DATA, NgxDialogModule, NgxDialogRef } from '../../extensions/dialog';

@Component({
  selector: 'app-preview-dialog',
  templateUrl: './preview-dialog.component.html',
  styleUrls: ['./preview-dialog.component.scss'],
  imports: [FormsModule, NgxDialogModule, MatButtonModule],
  providers: [],
})
export class PreviewDialogComponent implements AfterViewInit, OnDestroy {
  @ViewChild('previewIframe') iframe!: ElementRef<HTMLIFrameElement>;

  private iframeApp?: ApplicationRef;

  daialogData = inject<{
    data: IPagebuilderOutput;
    dynamicData: DynamicDataStructure[];
    viewMode: ViewMode;
  }>(DIALOG_DATA);
  constructor(private dialogRef: NgxDialogRef) {
    providePagePreview({
      customSources: LibConsts.SourceItemList.filter((x) => x.isUserDefined),
      publicCss: LibConsts.publicCss,
      publicJs: LibConsts.publicJs,
    });
  }

  ngAfterViewInit() {
    this.loadComponentInIframe();
  }
  ngOnDestroy(): void {
    // پاکسازی Angular app داخل iframe
    if (this.iframeApp) {
      this.iframeApp.destroy();
    }
  }

  async loadComponentInIframe(): Promise<void> {
    const iframeDoc = this.iframe.nativeElement.contentDocument;
    const iframeWindow = this.iframe.nativeElement.contentWindow;

    if (!iframeDoc || !iframeWindow) return;

    // ۱. ساخت ساختار HTML برای iframe
    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <base href="/">
          ${this.copyAllStyles()} 
        </head>
        <body>
          <div id="angular-app-root"></div>
        </body>
      </html>
    `);
    iframeDoc.close();

    // ۲. صبر برای load شدن
    await new Promise((resolve) => setTimeout(resolve, 100));

    // ۳. ساخت یک Angular Application جدید داخل iframe
    this.iframeApp = await createApplication({
      providers: [
        // اینجا provider های مورد نیازت رو اضافه کن
        importProvidersFrom(CommonModule),
        // اگه service های خاصی نیاز داری:
        // { provide: MyService, useValue: myServiceInstance }
      ],
    });

    // ۴. ساخت component داخل این application
    const appRoot = iframeDoc.getElementById('angular-app-root')!;

    const componentRef = createComponent(NgxPagePreviewComponent, {
      environmentInjector: this.iframeApp.injector,
      hostElement: appRoot,
    });

    // ۵. تنظیم Input ها
    componentRef.setInput('data', this.daialogData.data);
    componentRef.setInput('dynamicData', this.daialogData.dynamicData);
    componentRef.setInput('viewMode', this.daialogData.viewMode);
    componentRef.setInput('doc', iframeDoc);

    // ۶. اتصال به Angular
    this.iframeApp.attachView(componentRef.hostView);

    // ۷. اجرای change detection
    componentRef.changeDetectorRef.detectChanges();

    this.copyDynamicStyles(iframeDoc);
  }

  /**
   * کپی کردن همه استایل‌ها از document اصلی
   *
   * TODO: همه استایل های پروژه نباید انتقال پیدا کند فقط استایل ها استفاده شده در صفحه ساز
   */
  private copyAllStyles(): string {
    const styles = Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((el) => el.outerHTML)
      .join('\n');

    return styles;
  }

  /**
   * کپی کردن استایل‌هایی که بعد از render اضافه شدند
   * TODO: همه استایل های پروژه نباید انتقال پیدا کند فقط استایل ها استفاده شده در صفحه ساز
   */
  private copyDynamicStyles(iframeDoc: Document): void {
    const mainDocStyles = document.head.querySelectorAll('style');
    const iframeStyles = new Set(Array.from(iframeDoc.head.querySelectorAll('style')).map((s) => s.textContent));

    mainDocStyles.forEach((styleEl) => {
      // اگه این style قبلاً کپی نشده، کپی کن
      if (!iframeStyles.has(styleEl.textContent)) {
        const clonedStyle = styleEl.cloneNode(true) as HTMLStyleElement;
        iframeDoc.head.appendChild(clonedStyle);
      }
    });
  }
}
