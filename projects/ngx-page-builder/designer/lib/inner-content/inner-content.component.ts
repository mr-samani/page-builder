import {
  AfterViewInit,
  Component,
  DOCUMENT,
  ElementRef,
  inject,
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
  constructor(private el: ElementRef<HTMLElement>) {
    super();
    this.pb.innerShadowRootDom = this.el.nativeElement.shadowRoot;
    this.pb.cls.innerShadowRootDom = this.el.nativeElement.shadowRoot;
  }

  ngOnInit() {
    if (this.viewMode == 'PrintPage') {
      this.containerClassName = `ngx-paper ${this.pb.pageInfo.config.size} ${this.pb.pageInfo.config.orientation}`;
    } else {
      this.containerClassName = `web-page-view`;
    }
    for (let js of LibConsts.publicJs) {
      const j = this.doc.createElement('script');
      j.src = js;
      j.id = js.split('/').pop()?.split('.').at(0) ?? 'publicJs-' + Math.random() * 10000;

      this.el.nativeElement.shadowRoot?.insertBefore(j, this.el.nativeElement.shadowRoot?.firstChild);
    }

    console.log('pageinfo:', this.pb.pageInfo);
  }
}
