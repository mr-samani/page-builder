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
} from '@angular/core';

import {
  validateViewMode,
  ViewMode,
  LibPreviewConsts,
  PagePreviewService,
  DynamicDataService,
  DynamicDataStructure,
  IPagebuilderOutput,
} from 'ngx-page-builder/core';

@Component({
  standalone: true,
  selector: 'ngx-page-preview',
  templateUrl: './ngx-page-preview.component.html',
  styleUrls: ['./ngx-page-preview.component.scss', '../../../designer/styles/paper.scss'],
})
export class NgxPagePreviewComponent implements AfterViewInit {
  @Input() doc = inject(DOCUMENT);
  public readonly previewService = inject(PagePreviewService);
  private readonly dynamicDataService = inject(DynamicDataService);
  isPrintPage = false;
  @Input('dynamicData') set setDynamicData(val: DynamicDataStructure[]) {
    this.dynamicDataService.dynamicData = val;
  }

  @Input() data!: IPagebuilderOutput;

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

  constructor(private renderer: Renderer2, private chdRef: ChangeDetectorRef) {}

  ngAfterViewInit() {
    this.renderer.listen(window, 'beforeprint', this.onBeforePrint.bind(this));
    // ۴. اضافه کردن CSS های عمومی (Bootstrap و غیره)
    for (let css of LibPreviewConsts.publicCss) {
      const s = this.doc.createElement('link');
      s.href = css;
      s.rel = 'stylesheet';
      s.type = 'text/css';
      s.id =
        'S_' + (css.split('/').pop()?.split('.').at(0) ?? 'publicCss-' + Math.random() * 10000);
      this.doc.head.appendChild(s);
    }

    // ۵. اضافه کردن JavaScript های عمومی
    for (let js of LibPreviewConsts.publicJs) {
      const j = this.doc.createElement('script');
      j.src = js;
      j.id = 'j_' + (js.split('/').pop()?.split('.').at(0) ?? 'publicJs-' + Math.random() * 10000);
      this.doc.head.appendChild(j);
    }

    this.load();
  }

  load() {
    if (this.data.styles && Array.isArray(this.data.styles)) {
      for (let f of this.data.styles) {
        const s = this.doc.createElement('style');
        s.id = f.name;
        s.innerHTML = f.data;
        this.doc.head.appendChild(s);
      }
    }
    console.log(this.data);
    setTimeout(async () => {
      const pageContainer = this.paper()?.nativeElement;
      if (pageContainer) {
        pageContainer.setAttribute('dir', this.data.config.direction);
        await this.previewService.initializePreview(pageContainer, this.data);
        pageContainer.classList.add(...this.previewService.containerClassName.split(' '));
      }
    });
  }

  onBeforePrint(event: Event): void {
    // لغو عملیات پیش‌فرض پرینت
    event.preventDefault();
    event.stopPropagation();
    this.isPrintPage = true;
    this.chdRef.detectChanges();
    setTimeout(() => {
      window.print();
    });
  }
}
