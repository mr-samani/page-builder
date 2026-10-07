import { ChangeDetectionStrategy, Component, effect, model, untracked, ViewEncapsulation } from '@angular/core';
import { BaseComponent } from '../BaseComponent';
import { SpacingControlComponent } from '../../controls/spacing-control/spacing-control.component';
import { FormsModule } from '@angular/forms';
import { TypographyControlComponent } from '../../controls/typography-control/typography-control.component';
import { BackgroundControlComponent } from '../../controls/beckground-control/background-control.component';
import { DisplayControlComponent } from '../../controls/display-control/display-control.component';
import { TextCssControlComponent } from '../../controls/textcss-control/textcss-control.component';
import { SizeControlComponent } from '../../controls/size-control/size-control.component';
import { TransformControlComponent } from '../../controls/transform-control/transform-control.component';
import { TransitionControlComponent } from '../../controls/transition-control/transition-control.component';
import { ClassSelectorComponent } from '../class-selector/class-selector.component';
import { CSSStyleHelper } from '../../helper/CSSStyle';
import { PageItem, BlockCssContext, PseudoState } from 'ngx-page-builder/core';
import { ChangeTagComponent } from '../change-tag/change-tag.component';
import { NgxShadowBox } from 'ngx-kit/box-shadow';

/** فقط همین‌ها از getComputedStyle خوانده می‌شوند (یک‌بار هنگام لود) */
const TYPO_KEYS = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'lineHeight',
  'color',
  'textAlign',
  'textDecorationLine',
  'textTransform',
  'letterSpacing',
  'wordSpacing',
  'textIndent',
  'direction',
] as const;

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
    NgxShadowBox,
    TransformControlComponent,
    TransitionControlComponent,
    DisplayControlComponent,
    TextCssControlComponent,
    SizeControlComponent,
    ClassSelectorComponent,
    ChangeTagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class BlockPropertiesComponent extends BaseComponent {
  item?: PageItem;

  /** مقدار نمایش‌داده‌شده در کنترل‌ها = مقدار «مؤثر» (شامل ارث‌بری از base / breakpoint های بزرگ‌تر) */
  style: Partial<CSSStyleDeclaration> = {};

  cssPseudoState = model<PseudoState>('none');

  /** آیا در context فعلی (breakpoint + state) خود کاربر چیزی override کرده؟ */
  hasOverride = false;

  /**
   * display «محاسبه‌شده» از مرورگر (شامل کلاس‌ها / Bootstrap) برای خودِ بلاک و والدش.
   * کنترل Display از این‌ها می‌فهمد المان واقعاً flex/grid است (حتی با `.d-flex`) و کدام تنظیمات فرزند معنی دارد.
   */
  computedDisplay = '';
  parentDisplay: string | undefined = undefined;
  parentFlexDirection = 'row';
  /** مقدارهای محاسبه‌شده‌ی تایپوگرافی؛ فیلدهای ست‌نشده با آن‌ها placeholder و پیش‌نمایش درست می‌گیرند */
  computedTypography: Record<string, string> = {};

  /**
   * snapshot مقدار مؤثر هنگام لود (kebab-case). کنترل‌ها همیشه «کل شیء style» را emit می‌کنند،
   * پس با مقایسه‌ی آن با این snapshot می‌فهمیم دقیقاً کدام property را کاربر عوض کرده
   * (و مقادیر ارث‌بری‌شده‌ی دست‌نخورده به‌عنوان override ذخیره نمی‌شوند).
   */
  private loaded: Record<string, string> = {};

  constructor() {
    super();
    // با عوض شدن بلاک فعال، breakpoint (toolbar) یا state (hover/...) دوباره لود می‌شود
    effect(() => {
      const item = this.pb.activeEl();
      // console.log('block selected:', item?.id);
      const bp = this.pb.responsive();
      const state = this.cssPseudoState();
      untracked(() => this.load(item, { bp: bp.key, state }));
    });
  }

  /** breakpoint و state فعلی */
  private get ctx(): BlockCssContext {
    return { bp: this.pb.responsive().key, state: this.cssPseudoState() };
  }

  get contextLabel(): string {
    const s = this.cssPseudoState();
    return this.pb.responsive().key + (s === 'none' ? '' : ' · ' + s);
  }

  openPanel(_key: HTMLDetailsElement) {
    this.chdRef.detectChanges();
  }

  private load(item: PageItem | undefined, ctx: BlockCssContext) {
    this.item = item;
    this.readLayoutContext(item);
    if (item) {
      this.loaded = this.cls.getEffectiveDeclarations(item, ctx);
      this.style = CSSStyleHelper.declsToStyleObject(this.loaded);
      this.hasOverride = this.cls.hasOwnDeclarations(item, ctx);
    } else {
      this.loaded = {};
      this.style = {};
      this.hasOverride = false;
    }
    this.chdRef.detectChanges();
  }

  /** یک‌بار هنگام لود (نه در مسیر داغ ویرایش) */
  private readLayoutContext(item: PageItem | undefined) {
    this.computedDisplay = '';
    this.parentDisplay = undefined;
    this.parentFlexDirection = 'row';
    this.computedTypography = {};
    try {
      const own = item?.el;
      const par = item?.parent?.el;
      if (own?.ownerDocument?.defaultView) {
        const cs = own.ownerDocument.defaultView.getComputedStyle(own);
        this.computedDisplay = cs.display;
        const t: Record<string, string> = {};
        for (const k of TYPO_KEYS) t[k] = cs[k];
        this.computedTypography = t;
      }
      if (par?.ownerDocument?.defaultView) {
        const cs = par.ownerDocument.defaultView.getComputedStyle(par);
        this.parentDisplay = cs.display;
        this.parentFlexDirection = cs.flexDirection || 'row';
      }
    } catch {
      /* المان هنوز ساخته نشده یا iframe در دسترس نیست */
    }
  }
  onShadowChange(ev: string) {
    this.onChangeStyle(this.style);
  }
  /**
   * هر کنترل با هر تغییر، کل شیء style را emit می‌کند.
   * فقط تفاوت با مقدار لودشده روی item.css (در breakpoint/state فعال) نوشته می‌شود:
   *  - مقدار تغییر کرده/اضافه شده → override ثبت می‌شود
   *  - مقدار خالی شده → override حذف می‌شود (مقدار ارث‌بری‌شده دوباره اعمال می‌شود)
   */
  onChangeStyle(ev: Partial<CSSStyleDeclaration>) {
    const item = this.item;
    if (!item) return;
    // اگر کنترل خروجی‌ای به اسم `change` دارد، رویداد DOM ـی `change` ورودی‌های داخلش هم (با bubble) به همین handler می‌رسد.
    // آن یک Event است نه شیء style؛ بدون این گارد، «همه‌ی» استایل‌ها به‌عنوان حذف‌شده تفسیر می‌شدند.
    if (typeof Event !== 'undefined' && (ev as unknown) instanceof Event) return;

    const next = CSSStyleHelper.styleObjectToDecls(ev);
    const patch: Record<string, string | null> = {};
    let dirty = false;

    for (const k in next) {
      if (this.loaded[k] !== next[k]) {
        patch[k] = next[k];
        dirty = true;
      }
    }
    for (const k in this.loaded) {
      if (!(k in next)) {
        patch[k] = null;
        dirty = true;
      }
    }
    if (!dirty) return;

    // برای history: قبل از اولین تغییر یک burst، snapshot قبلی را نگه می‌داریم
    this.pb.beforeStyleChange(item);
    if (!this.cls.setBlockStyle(item, this.ctx, patch)) return;

    // snapshot را با همان patch به‌روز می‌کنیم (بدون خواندن دوباره‌ی CSSOM)
    for (const k in patch) {
      if (patch[k] === null) delete this.loaded[k];
      else this.loaded[k] = patch[k]!;
    }
    this.hasOverride = this.cls.hasOwnDeclarations(item, this.ctx);
    this.chdRef.markForCheck();

    this.pb.notifyStyleChanged(item);
  }

  /** حذف همه‌ی override های context فعلی (برمی‌گردد به مقدار ارث‌بری‌شده) */
  resetContext() {
    const item = this.item;
    if (!item) return;
    this.pb.beforeStyleChange(item);
    if (this.cls.resetBlockContext(item, this.ctx)) this.pb.notifyStyleChanged(item);
    this.load(item, this.ctx);
  }
}
