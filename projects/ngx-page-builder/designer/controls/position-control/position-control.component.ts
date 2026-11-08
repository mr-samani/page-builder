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
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { CSSStyleHelper } from '../../helper/CSSStyle';
import { BaseControl } from '../base-control';
import { CssUnitFieldComponent } from '../css-unit-field/css-unit-field.component';
import { SegGroupComponent, SegOption } from '../seg-group/seg-group.component';
import {
  ANCHORS,
  AnchorPreset,
  INSET_KEYS,
  InsetKey,
  POSITION_HINTS,
  PositionKind,
  PositionModel,
  Z_QUICK,
  clonePositionModel,
  createPositionModel,
  declsToCssText,
  hasPosition,
  parsePositionModel,
  serializePositionModel,
} from './position-model';

const KINDS: SegOption[] = [
  { value: 'static', label: 'Static', text: 'Static', title: 'static: normal flow' },
  { value: 'relative', label: 'Relative', text: 'Relative', title: 'relative: offset from its normal place' },
  { value: 'absolute', label: 'Absolute', text: 'Absolute', title: 'absolute: placed against the nearest positioned ancestor' },
  { value: 'fixed', label: 'Fixed', text: 'Fixed', title: 'fixed: placed against the viewport' },
  { value: 'sticky', label: 'Sticky', text: 'Sticky', title: 'sticky: sticks when scrolled to its offset' },
];

interface InsetRow {
  key: InsetKey;
  label: string;
}

const INSET_ROWS: InsetRow[] = [
  { key: 'top', label: 'Top' },
  { key: 'right', label: 'Right' },
  { key: 'bottom', label: 'Bottom' },
  { key: 'left', label: 'Left' },
];

/**
 * کنترل «Position»:
 *  - نوع position (static / relative / absolute / fixed / sticky) با راهنمای کوتاه
 *  - offset های top / right / bottom / left (px, %, em, rem, vw, vh یا `auto` / var / calc)
 *  - میان‌برهای «چسباندن» (گوشه‌ها، Fill، Stretch X/Y)
 *  - z-index با مقدارهای سریع
 *
 * خروجی: `position` + `top|right|bottom|left` + `z-index` — به position-model.ts نگاه کنید.
 */
@Component({
  selector: 'position-control',
  templateUrl: './position-control.component.html',
  styleUrls: ['./position-control.component.scss'],
  standalone: true,
  imports: [CssUnitFieldComponent, SegGroupComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PositionControlComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PositionControlComponent extends BaseControl {
  @Output() change = new EventEmitter<Partial<CSSStyleDeclaration>>();

  /**
   * position «محاسبه‌شده» از مرورگر (شامل کلاس‌ها / Bootstrap)؛ وقتی کاربر خودش چیزی ست نکرده
   * با آن می‌فهمیم المان واقعاً static است یا نه.
   */
  readonly computedPosition = input<string>('');
  /** آیا context فعلی (breakpoint کوچک‌تر یا state) از جای دیگری ارث می‌برد؟ ضلع‌های آزاد باید `auto` شوند */
  readonly inherits = input<boolean>(false);

  private readonly cd = inject(ChangeDetectorRef);

  protected readonly kinds = KINDS;
  protected readonly rows = INSET_ROWS;
  protected readonly anchors = ANCHORS;
  protected readonly zQuick = Z_QUICK;
  protected readonly units = ['px', '%', 'em', 'rem', 'vw', 'vh'] as const;
  protected readonly keywords = ['auto'] as const;

  protected readonly model = signal<PositionModel>(createPositionModel());

  protected readonly hasAny = computed(() => hasPosition(this.model()));

  /** position مؤثر: انتخاب کاربر ← محاسبه‌شده ← static */
  protected readonly effective = computed<PositionKind>(() => {
    const v = (this.model().position || this.computedPosition() || 'static').toLowerCase();
    return (KINDS.some((k) => k.value === v) ? v : 'static') as PositionKind;
  });
  protected readonly insetsActive = computed(() => this.effective() !== 'static');
  protected readonly canAnchor = computed(() => this.effective() === 'absolute' || this.effective() === 'fixed');
  protected readonly hint = computed(() => POSITION_HINTS[this.effective()]);
  /** sticky بدون هیچ offset ای کاری نمی‌کند */
  protected readonly stickyWarn = computed(() => {
    if (this.effective() !== 'sticky') return false;
    const m = this.model();
    return INSET_KEYS.every((k) => !m[k] || m[k] === 'auto');
  });
  protected readonly previewCss = computed(() => declsToCssText(serializePositionModel(this.model())));

  //---------------------------------- ControlValueAccessor ----------------------------------

  writeValue(style: Partial<CSSStyleDeclaration>): void {
    this.style = style ?? {};
    this.model.set(parsePositionModel(CSSStyleHelper.styleObjectToDecls(this.style)));
    this.cd.markForCheck();
  }

  //---------------------------------- emit ----------------------------------

  private commit(): void {
    Object.assign(this.style, CSSStyleHelper.declsToStyleObject(serializePositionModel(this.model())));
    this.onChange(this.style);
    this.change.emit(this.style);
    this.cd.markForCheck();
  }

  private update(fn: (m: PositionModel) => void): void {
    const next = clonePositionModel(this.model());
    fn(next);
    this.model.set(next);
    this.commit();
  }

  //---------------------------------- actions ----------------------------------

  protected inset(k: InsetKey): string {
    return this.model()[k];
  }

  protected setPosition(v: string): void {
    this.update((m) => (m.position = (v ?? '').trim().toLowerCase()));
  }

  protected setInset(k: InsetKey, v: string | undefined | null): void {
    this.update((m) => (m[k] = (v ?? '').trim()));
  }

  protected clearInset(k: InsetKey): void {
    this.setInset(k, '');
  }

  protected setZ(v: string | undefined | null): void {
    this.update((m) => (m.zIndex = (v ?? '').trim()));
  }

  protected applyAnchor(a: AnchorPreset): void {
    // ضلع‌های آزاد: در context ارث‌بر `auto` (تا مقدار ارث‌بری‌شده خنثی شود)، وگرنه حذف
    const free = this.inherits() ? 'auto' : '';
    this.update((m) => {
      if (!this.canAnchor()) m.position = 'absolute';
      for (const k of INSET_KEYS) m[k] = a.set[k] ?? free;
    });
  }

  protected clearInsets(): void {
    this.update((m) => {
      for (const k of INSET_KEYS) m[k] = '';
    });
  }

  protected hasInsets(): boolean {
    const m = this.model();
    return INSET_KEYS.some((k) => !!m[k]);
  }

  protected reset(): void {
    this.model.set(createPositionModel());
    this.commit();
  }
}
