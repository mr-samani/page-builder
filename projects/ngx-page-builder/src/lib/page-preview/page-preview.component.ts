import {
  ChangeDetectorRef,
  Component,
  DOCUMENT,
  ElementRef,
  Inject,
  Input,
  OnInit,
  Renderer2,
  viewChild,
} from '@angular/core';
import { DynamicDataStructure } from '../../models/DynamicData';
import { DynamicDataService } from '../../services/dynamic-data.service';
import { LibConsts } from '../../consts/defauls';
import { validateViewMode, ViewMode } from '../../consts/ViewMode';
import { PagePreviewService } from '../../services/preview.service';
import { PageBuilderConfig } from '../../models/PageBuilderDto';
import { IPagebuilderOutput } from '../../contracts/IPageBuilderOutput';
import { IStyleSheetFile } from '../../contracts/IStyleSheetFile';
import { ClassManagerService } from '../../services/class-manager.service';
@Component({
  selector: 'ngx-page-preview',
  template: `<div
    class="ngx-page-builder"
    [class.is-print-page]="isPrintPage"
    #paper
    [attr.dir]="direction"
  ></div>`,
  styles: `
    .is-print-page {
      position: absolute;
      background: #fff;
      width: 100%;
      display: block;
      top: 0;
      left: 0;
      right: 0;
      z-index: 999999;
    }
  `,
})
export class NgxPagePreviewComponent implements OnInit {
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
  constructor(
    private cls: ClassManagerService,
    public previewService: PagePreviewService,
    private dynamicDataService: DynamicDataService,
    private renderer: Renderer2,
    private chdRef: ChangeDetectorRef,
    @Inject(DOCUMENT) private doc: Document,
  ) {}

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
    debugger;
    if (val.styles && Array.isArray(val.styles)) {
      for (let f of val.styles) this.cls.addCssFile(f.name ?? 'default', f.data);
    }
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
