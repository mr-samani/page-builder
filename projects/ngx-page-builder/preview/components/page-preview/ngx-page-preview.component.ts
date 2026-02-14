import {
  ChangeDetectorRef,
  Component,
  DOCUMENT,
  ElementRef,
  inject,
  Input,
  OnInit,
  Renderer2,
  viewChild,
} from '@angular/core';

import {
  validateViewMode,
  ViewMode,
  LibConsts,
  ClassManagerService,
  PagePreviewService,
  DynamicDataService,
  DynamicDataStructure,
  IPagebuilderOutput,
} from 'ngx-page-builder/core';

@Component({
  standalone: true,
  selector: 'ngx-page-preview',
  templateUrl: './ngx-page-preview.component.html',
  styleUrls: ['./ngx-page-preview.component.scss'],
})
export class NgxPagePreviewComponent implements OnInit {
  private readonly doc = inject(DOCUMENT);
  private readonly cls = inject(ClassManagerService);
  public readonly previewService = inject(PagePreviewService);
  private readonly dynamicDataService = inject(DynamicDataService);
  isPrintPage = false;
  direction = '';
  @Input('dynamicData') set setDynamicData(val: DynamicDataStructure[]) {
    this.dynamicDataService.dynamicData = val;
  }

  @Input('data') set setData(val: IPagebuilderOutput) {
    this.load(val);
  }

  @Input({
    alias: 'viewMode',
    transform: validateViewMode,
  })
  set viewMode(val: ViewMode) {
    LibConsts.viewMode = val;
  }
  get viewMode() {
    return LibConsts.viewMode;
  }

  private paper = viewChild<ElementRef<HTMLElement>>('paper');

  constructor(private renderer: Renderer2, private chdRef: ChangeDetectorRef) {}

  ngOnInit() {
    this.renderer.listen(window, 'beforeprint', this.onBeforePrint.bind(this));
    // ۴. اضافه کردن CSS های عمومی (Bootstrap و غیره)
    for (let css of LibConsts.publicCss) {
      const s = this.doc.createElement('link');
      s.href = css;
      s.rel = 'stylesheet';
      s.type = 'text/css';
      s.id =
        'S_' + (css.split('/').pop()?.split('.').at(0) ?? 'publicCss-' + Math.random() * 10000);
      this.doc.head.appendChild(s);
    }

    // ۵. اضافه کردن JavaScript های عمومی
    for (let js of LibConsts.publicJs) {
      const j = this.doc.createElement('script');
      j.src = js;
      j.id = 'j_' + (js.split('/').pop()?.split('.').at(0) ?? 'publicJs-' + Math.random() * 10000);
      this.doc.head.appendChild(j);
    }
  }

  load(val: IPagebuilderOutput) {
    this.direction = val.config.direction;
    if (val.styles && Array.isArray(val.styles)) {
      for (let f of val.styles) this.cls.addToDefaultStyles(f.data);
    }
    console.log(val);
    setTimeout(async () => {
      const pageContainer = this.paper()?.nativeElement;
      if (pageContainer) {
        await this.previewService.initializePreview(pageContainer, val);
        pageContainer.classList.add(this.previewService.containerClassName);
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
