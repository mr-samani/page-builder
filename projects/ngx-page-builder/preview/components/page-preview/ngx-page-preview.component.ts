import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  DOCUMENT,
  ElementRef,
  inject,
  Input,
  Renderer2,
  viewChild,
  ChangeDetectionStrategy,
  PendingTasks,
} from '@angular/core';

import {
  validateViewMode,
  ViewMode,
  LibPreviewConsts,
  PagePreviewService,
  DynamicDataService,
  DynamicDataStructure,
  IPagebuilderOutput,
  PageBuilderConfig,
  applyBlockStylesToDocument,
} from 'ngx-page-builder/core';

@Component({
  standalone: true,
  selector: 'ngx-page-preview',
  templateUrl: './ngx-page-preview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./ngx-page-preview.component.scss', '../../../designer/styles/paper.scss'],
})
export class NgxPagePreviewComponent implements AfterViewInit {
  @Input() doc = inject(DOCUMENT);

  public readonly previewService = inject(PagePreviewService);
  private readonly dynamicDataService = inject(DynamicDataService);
  private readonly pendingTasks = inject(PendingTasks);
  isPrintPage = false;
  @Input('dynamicData') set setDynamicData(val: DynamicDataStructure[]) {
    this.dynamicDataService.dynamicData = val;
  }
  data: IPagebuilderOutput = {
    config: new PageBuilderConfig(),
    cssVariables: [],
    data: [],
    styles: [],
  };
  @Input('data') set setData(data: IPagebuilderOutput | undefined) {
    this.data = data || {
      config: new PageBuilderConfig(),
      cssVariables: [],
      data: [],
      styles: [],
    };
    this.load();
  }

  @Input({
    alias: 'viewMode',
    transform: validateViewMode,
  })
  set viewMode(val: ViewMode) {
    LibPreviewConsts.viewMode = val;
  }
  get viewMode() {
    return LibPreviewConsts.viewMode;
  }

  private paper = viewChild<ElementRef<HTMLElement>>('paper');

  constructor(
    private renderer: Renderer2,
    private chdRef: ChangeDetectorRef,
  ) {}

  ngAfterViewInit() {
    if (this.doc) {
      this.renderer.listen(this.doc, 'beforeprint', this.onBeforePrint.bind(this));
    }
    // ۴. اضافه کردن CSS های عمومی (Bootstrap و غیره)
    // اگر قبلاً در document بود (HTML ی SSR، یا ساخته‌شدن دوباره‌ی کامپوننت) دوباره اضافه نمی‌کنیم
    for (let css of LibPreviewConsts.publicCss) {
      const id = 'S_' + (css.split('/').pop()?.split('.').at(0) ?? 'publicCss-' + Math.random() * 10000);
      if (this.doc.getElementById(id)) continue;
      const s = this.doc.createElement('link');
      s.href = css;
      s.rel = 'stylesheet';
      s.type = 'text/css';
      s.id = id;
      this.doc.head.appendChild(s);
    }

    // ۵. اضافه کردن JavaScript های عمومی
    for (let js of LibPreviewConsts.publicJs) {
      const id = 'j_' + (js.split('/').pop()?.split('.').at(0) ?? 'publicJs-' + Math.random() * 10000);
      if (this.doc.getElementById(id)) continue;
      const j = this.doc.createElement('script');
      j.src = js;
      j.id = id;
      this.doc.head.appendChild(j);
    }
    // لینک‌های Bootstrap همین‌جا اضافه شدند؛ استایل بلاک‌ها را دوباره به انتهای head می‌بریم تا اولویت را از دست ندهد
    applyBlockStylesToDocument(this.doc, this.data.data, this.data.cssVariables);
  }

  /**
   * رندر preview. داخل PendingTasks است تا سرور (SSR) و حالت zoneless قبل از تمام شدن رندر
   * (import() ی lazy ی کامپوننت‌ها، async ها) HTML را serialize نکنند.
   */
  load() {
    this.pendingTasks.run(() => this.render());
  }

  private async render() {
    console.time('LoadPreview');

    if (this.data.styles && Array.isArray(this.data.styles)) {
      for (let f of this.data.styles) {
        // getElementById: اسم فایل می‌تواند space یا نقطه داشته باشد و در selector ی `style#name` خطا می‌دهد
        this.doc.getElementById(f.name)?.remove();

        const s = this.doc.createElement('style');
        s.id = f.name;
        s.innerHTML = f.data;
        this.doc.head.appendChild(s);
      }
    }
    // console.log(this.data);
    //setTimeout(async () => {
    const pageContainer = this.paper()?.nativeElement;
    if (pageContainer) {
      await this.previewService.initializePreview(pageContainer, this.data);
      pageContainer.classList.add(...this.previewService.containerClassName.split(' '));
    }
    // });
    console.timeEnd('LoadPreview');
  }

  onBeforePrint(event: Event): void {
    // لغو عملیات پیش‌فرض پرینت
    event.preventDefault();
    event.stopPropagation();
    this.isPrintPage = true;
    this.chdRef.detectChanges();
    setTimeout(() => {
      print();
    });
  }
}
