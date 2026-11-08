import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  EventEmitter,
  forwardRef,
  inject,
  input,
  Output,
  signal,
} from '@angular/core';
import { FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CSSStyleHelper } from '../../helper/CSSStyle';
import { BaseControl } from '../base-control';
import { CssUnitFieldComponent } from '../css-unit-field/css-unit-field.component';
import { InputCssComponent } from '../input-css/input-css.component';
import { SegGroupComponent, SegOption } from '../seg-group/seg-group.component';
import {
  BORDER_PRESETS,
  BORDER_PROPS,
  BORDER_SIDES,
  BorderModel,
  BorderPreset,
  BorderProp,
  BorderSideKey,
  BorderTarget,
  OUTLINE_STYLES,
  OutlineModel,
  borderShape,
  cloneBorderModel,
  cloneOutlineModel,
  createBorderModel,
  createOutlineModel,
  declsToCssText,
  hasBorder,
  hasOutline,
  parseBorderModel,
  parseOutlineModel,
  serializeBorderModel,
  serializeOutlineModel,
  sideVisible,
} from './border-model';

interface PresetView {
  id: string;
  label: string;
  /** CSS برای thumbnail */
  css: string;
  shape: string;
  preset: BorderPreset;
}

const TARGET_LABEL: Record<BorderTarget, string> = {
  all: 'All sides',
  top: 'Top',
  right: 'Right',
  bottom: 'Bottom',
  left: 'Left',
};

const STYLE_QUICK: SegOption[] = [
  { value: 'none', label: 'None', text: 'None' },
  { value: 'solid', label: 'Solid', text: 'Solid' },
  { value: 'dashed', label: 'Dashed', text: 'Dashed' },
  { value: 'dotted', label: 'Dotted', text: 'Dotted' },
  { value: 'double', label: 'Double', text: 'Double' },
];

/** سبک‌های کم‌کاربرد؛ در select «More…» */
const STYLE_MORE = ['groove', 'ridge', 'inset', 'outset', 'hidden'] as const;

/**
 * کنترل «Border»:
 *  - Preset ها + پیش‌نمایش زنده
 *  - انتخاب ضلع (All / Top / Right / Bottom / Left)؛ «All» هر چهار ضلع را با هم عوض می‌کند
 *  - عرض (px/em/rem/thin/medium/thick/var/calc) ، سبک ، رنگ (با پشتیبانی از متغیرهای CSS)
 *  - بخش جمع‌شونده‌ی Outline (عرض، سبک، رنگ، offset)
 *
 * خروجی: `border-width` / `border-style` / `border-color` (و `outline-*`) — به border-model.ts نگاه کنید.
 * شعاع گوشه‌ها (`border-radius`) در کنترل Corners است.
 */
@Component({
  selector: 'border-control',
  templateUrl: './border-control.component.html',
  styleUrls: ['./border-control.component.scss'],
  standalone: true,
  imports: [FormsModule, CssUnitFieldComponent, SegGroupComponent, InputCssComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => BorderControlComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BorderControlComponent extends BaseControl {
  @Output() change = new EventEmitter<Partial<CSSStyleDeclaration>>();

  /** آیا context فعلی (breakpoint کوچک‌تر یا state) از جای دیگری ارث می‌برد؟ */
  readonly inherits = input<boolean>(false);

  private readonly cd = inject(ChangeDetectorRef);

  protected readonly sides = BORDER_SIDES;
  protected readonly targetLabel = TARGET_LABEL;
  protected readonly styleQuick = STYLE_QUICK;
  protected readonly styleMore = STYLE_MORE;
  protected readonly outlineStyles = OUTLINE_STYLES;
  protected readonly widthUnits = ['px', 'em', 'rem'] as const;
  protected readonly widthKeywords = ['thin', 'medium', 'thick'] as const;
  protected readonly offsetUnits = ['px', 'em', 'rem'] as const;

  protected readonly model = signal<BorderModel>(createBorderModel());
  protected readonly outline = signal<OutlineModel>(createOutlineModel());
  protected readonly target = signal<BorderTarget>('all');
  protected readonly outlineOpen = signal(false);
  /** declaration های لودشده (برای تصمیم «خاموش کردن» در context های ارث‌بر) */
  private loaded: Record<string, string> = {};

  protected readonly presets: PresetView[] = BORDER_PRESETS.map((p) => {
    const m = p.build('');
    return {
      id: p.id,
      label: p.label,
      css: declsToCssText(serializeBorderModel(m, { loaded: {}, inherits: false })),
      shape: borderShape(m),
      preset: p,
    };
  });

  protected readonly hasAny = computed(() => hasBorder(this.model()));
  protected readonly hasOutlineAny = computed(() => hasOutline(this.outline()));

  protected readonly activePreset = computed(() => {
    const s = borderShape(this.model());
    return this.presets.find((p) => p.shape === s)?.id ?? '';
  });

  protected readonly targetSides = computed<BorderSideKey[]>(() => {
    const t = this.target();
    return t === 'all' ? [...BORDER_SIDES] : [t];
  });

  /** ضلعی که فیلدها نشان می‌دهند (در حالت All: top) */
  protected readonly cur = computed(() => this.model()[this.target() === 'all' ? 'top' : (this.target() as BorderSideKey)]);

  protected readonly anyMixed = computed(() => BORDER_PROPS.some((p) => this.mixed(p)));

  /** پیش‌نمایش زنده: دقیقاً همان CSS ای که روی بلاک نوشته می‌شود */
  protected readonly previewCss = computed(() =>
    declsToCssText({
      ...serializeBorderModel(this.model(), { loaded: {}, inherits: false }),
      ...serializeOutlineModel(this.outline(), { loaded: {}, inherits: false }),
    }),
  );

  //---------------------------------- ControlValueAccessor ----------------------------------

  writeValue(style: Partial<CSSStyleDeclaration>): void {
    this.style = style ?? {};
    this.loaded = CSSStyleHelper.styleObjectToDecls(this.style);
    const outline = parseOutlineModel(this.loaded);
    this.model.set(parseBorderModel(this.loaded));
    this.outline.set(outline);
    this.outlineOpen.set(hasOutline(outline));
    this.cd.markForCheck();
  }

  //---------------------------------- emit ----------------------------------

  private commit(): void {
    const opt = { loaded: this.loaded, inherits: this.inherits() };
    const decls = {
      ...serializeBorderModel(this.model(), opt),
      ...serializeOutlineModel(this.outline(), opt),
    };
    Object.assign(this.style, CSSStyleHelper.declsToStyleObject(decls));
    this.onChange(this.style);
    this.change.emit(this.style);
    this.cd.markForCheck();
  }

  private update(fn: (m: BorderModel) => void): void {
    const next = cloneBorderModel(this.model());
    fn(next);
    this.model.set(next);
    this.commit();
  }

  private updateOutline(fn: (o: OutlineModel) => void): void {
    const next = cloneOutlineModel(this.outline());
    fn(next);
    this.outline.set(next);
    this.commit();
  }

  //---------------------------------- reading ----------------------------------

  /** آیا ضلع‌های هدف در این property با هم فرق دارند؟ (فقط در حالت All) */
  protected mixed(prop: BorderProp): boolean {
    if (this.target() !== 'all') return false;
    const m = this.model();
    return BORDER_SIDES.some((k) => m[k][prop] !== m.top[prop]);
  }

  /** مقدار نمایشی فیلد؛ در حالت mixed خالی (و placeholder «Mixed») */
  protected val(prop: BorderProp): string {
    return this.mixed(prop) ? '' : this.cur()[prop];
  }

  protected sideOn(s: BorderSideKey): boolean {
    return sideVisible(this.model()[s]);
  }

  protected isMoreStyle(v: string): boolean {
    return (STYLE_MORE as readonly string[]).includes(v);
  }

  //---------------------------------- actions ----------------------------------

  protected pick(t: BorderTarget): void {
    this.target.set(t);
  }

  /**
   * عرض/سبک/رنگ را روی ضلع‌های هدف می‌نویسد.
   * وقتی کاربر چیزی را ست می‌کند که باید «دیده شود»، اجزای لازم را کامل می‌کنیم
   * (وگرنه با style=none خطی دیده نمی‌شود، یا با عرض پیش‌فرض `medium` ≈ 3px ظاهر می‌شود).
   */
  protected setProp(prop: BorderProp, raw: string | undefined | null): void {
    const v = (raw ?? '').trim();
    this.update((m) => {
      for (const k of this.targetSides()) {
        const side = m[k];
        side[prop] = prop === 'style' ? v.toLowerCase() : v;
        if (!v) continue;
        if (prop !== 'style' && !side.style) side.style = 'solid';
        if (sideVisible(side) && !side.width) side.width = '1px';
      }
    });
  }

  protected clearTarget(): void {
    this.update((m) => {
      for (const k of this.targetSides()) m[k] = { width: '', style: '', color: '' };
    });
  }

  protected applyPreset(p: PresetView): void {
    const m = this.model();
    const color = BORDER_SIDES.map((k) => m[k].color).find((c) => !!c) ?? '';
    this.model.set(p.preset.build(color));
    this.commit();
  }

  protected reset(): void {
    this.model.set(createBorderModel());
    this.commit();
  }

  //---------------------------------- outline ----------------------------------

  protected setOutline(prop: keyof OutlineModel, raw: string | undefined | null): void {
    const v = (raw ?? '').trim();
    this.updateOutline((o) => {
      o[prop] = prop === 'style' ? v.toLowerCase() : v;
      if (!v) return;
      if ((prop === 'width' || prop === 'color') && !o.style) o.style = 'solid';
      if (prop === 'style' && v !== 'none' && !o.width) o.width = '2px';
    });
  }

  protected resetOutline(): void {
    this.outline.set(createOutlineModel());
    this.commit();
  }
}
