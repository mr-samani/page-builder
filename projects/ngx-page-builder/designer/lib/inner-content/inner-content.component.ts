import {
  Component,
  DOCUMENT,
  ElementRef,
  inject,
  Inject,
  Injector,
  OnInit,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { PageBuilderBaseComponent } from '../page-builder-base-component';
import { NgxDragDropKitModule } from 'ngx-drag-drop-kit';
import { LibConsts } from 'ngx-page-builder/core';

@Component({
  selector: 'inner-content',
  templateUrl: './inner-content.component.html',
  styleUrls: ['./inner-content.component.scss', '../../../../../node_modules/ngx-drag-drop-kit/assets/styles.css'],
  encapsulation: ViewEncapsulation.ShadowDom,
  imports: [NgxDragDropKitModule],
})
export class InnerContentComponent extends PageBuilderBaseComponent implements OnInit {
  containerClassName = '';

  private _pageBody = viewChild<ElementRef<HTMLElement>>('PageBody');
  private _pageHeader = viewChild<ElementRef<HTMLElement>>('PageHeader');
  private _pageFooter = viewChild<ElementRef<HTMLElement>>('PageFooter');
  private doc = inject(DOCUMENT);

  constructor(
    injector: Injector,
    private el: ElementRef<HTMLElement>,
  ) {
    super(injector);

    this.pageBuilder.pageBody = this._pageBody;
    this.pageBuilder.pageHeader = this._pageHeader;
    this.pageBuilder.pageFooter = this._pageFooter;
    this.pageBuilder.innerShadowRootDom = el.nativeElement.shadowRoot;
    this.pageBuilder.cls.innerShadowRootDom = el.nativeElement.shadowRoot;
  }

  ngOnInit() {
    if (this.viewMode == 'PrintPage') {
      this.containerClassName = `ngx-paper ${this.pageBuilder.pageInfo.config.size} ${this.pageBuilder.pageInfo.config.orientation}`;
    } else {
      this.containerClassName = `web-page-view`;
    }
    for (let js of LibConsts.publicJs) {
      const j = this.doc.createElement('script');
      j.src = js;
      j.id = js.split('/').pop()?.split('.').at(0) ?? 'publicJs-' + Math.random() * 10000;

      this.el.nativeElement.shadowRoot?.insertBefore(j, this.el.nativeElement.shadowRoot?.firstChild);
    }
  }
}
