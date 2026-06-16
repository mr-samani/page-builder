import { ChangeDetectionStrategy, Component, effect, Injector, OnInit, ViewEncapsulation } from '@angular/core';
import { BaseComponent } from '../BaseComponent';
import { SpacingControlComponent } from '../../controls/spacing-control/spacing-control.component';
import { FormsModule } from '@angular/forms';
import { TypographyControlComponent } from '../../controls/typography-control/typography-control.component';
import { BackgroundControlComponent } from '../../controls/beckground-control/background-control.component';
import { DisplayControlComponent } from '../../controls/display-control/display-control.component';
import { TextCssControlComponent } from '../../controls/textcss-control/textcss-control.component';
import { SizeControlComponent } from '../../controls/size-control/size-control.component';
import { ShadowControlComponent } from '../../controls/shadow-control/shadow-control.component';
import { ClassSelectorComponent, IClassOutput } from '../class-selector/class-selector.component';
import { CSSStyleHelper } from '../../helper/CSSStyle';
import { PageItem } from 'ngx-page-builder/core';
import { ChangeTagComponent } from '../change-tag/change-tag.component';

@Component({
  selector: 'block-properties',
  templateUrl: './block-properties.component.html',
  styleUrls: ['./block-properties.component.scss'],
  standalone: true,
  imports: [
    FormsModule,
    SpacingControlComponent,
    TypographyControlComponent,
    BackgroundControlComponent,
    ShadowControlComponent,
    DisplayControlComponent,
    TextCssControlComponent,
    SizeControlComponent,
    ClassSelectorComponent,
    ChangeTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class BlockPropertiesComponent extends BaseComponent implements OnInit {
  item?: PageItem;

  style: Partial<CSSStyleDeclaration> = {};

  currentCss = '';
  currentClassName = '';

  constructor(injector: Injector) {
    super(injector);
    effect(() => {
      this.item = this.pb.activeEl();
      // console.log('updated properties', this.item);

      this.chdRef.detectChanges();
    });
  }

  ngOnInit() {}
  openPanel(key: HTMLDetailsElement) {
    this.chdRef.detectChanges();
  }

  onSelectClass(cls: IClassOutput) {
    this.currentCss = cls.value;
    this.currentClassName = cls.name;
    debugger;
    this.style = CSSStyleHelper.cssTextToStyleObject(this.currentCss);
  }
}
