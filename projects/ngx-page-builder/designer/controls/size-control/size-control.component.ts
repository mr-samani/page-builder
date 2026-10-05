import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  forwardRef,
  inject,
  Output,
  computed,
  signal,
} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { BaseControl } from '../base-control';
import { CssUnitFieldComponent } from '../css-unit-field/css-unit-field.component';
import { OriginPadComponent, OriginValue } from '../origin-pad/origin-pad.component';
import { SegGroupComponent, SegOption } from '../seg-group/seg-group.component';
import { ORIGIN_DEFAULT, formatOrigin, parseOrigin } from '../transform-control/transform-model';
import { RATIO_PRESETS, isValidRatio, normalizeRatio } from './size-model';

/** نگه‌داری شده برای سازگاری با کدهای قدیمی */
export interface ISizeModel {
  width: string;
  minWidth: string;
  maxWidth: string;
  height: string;
  minHeight: string;
  maxHeight: string;
}
export type SizeProperty = 'width' | 'minWidth' | 'maxWidth' | 'height' | 'minHeight' | 'maxHeight';

interface SizeRow {
  prop: SizeProperty;
  label: string;
  title: string;
  fallback: string;
  keywords: readonly string[];
}

const SIZE_KW = ['auto', 'fit-content', 'min-content', 'max-content'] as const;
const MIN_KW = ['auto', 'fit-content', 'min-content', 'max-content'] as const;
const MAX_KW = ['none', 'fit-content', 'min-content', 'max-content'] as const;

const row = (
  prop: SizeProperty,
  label: string,
  title: string,
  fallback: string,
  keywords: readonly string[],
): SizeRow => ({
  prop,
  label,
  title,
  fallback,
  keywords,
});

const MAIN_ROWS: SizeRow[] = [
  row('width', 'Width', 'width', 'auto', SIZE_KW),
  row('height', 'Height', 'height', 'auto', SIZE_KW),
];
const MIN_ROWS: SizeRow[] = [
  row('minWidth', 'Min W', 'min-width', '0px', MIN_KW),
  row('minHeight', 'Min H', 'min-height', '0px', MIN_KW),
];
const MAX_ROWS: SizeRow[] = [
  row('maxWidth', 'Max W', 'max-width', 'none', MAX_KW),
  row('maxHeight', 'Max H', 'max-height', 'none', MAX_KW),
];

const OVERFLOW: SegOption[] = [
  {
    value: 'visible',
    label: 'Visible',
    paths: [
      'M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z',
      'M8 6.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z',
    ],
  },
  {
    value: 'hidden',
    label: 'Hidden',
    paths: ['M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z', 'M3 13L13 3'],
  },
  { value: 'scroll', label: 'Scroll', paths: ['M5 2.5h6v11H5z', 'M8 5v3.5'] },
  { value: 'auto', label: 'Auto', text: 'Auto' },
];

const FIT: SegOption[] = [
  { value: 'fill', label: 'Fill (stretch)', text: 'Fill' },
  { value: 'contain', label: 'Contain (fit inside)', text: 'Contain' },
  { value: 'cover', label: 'Cover (crop to fill)', text: 'Cover' },
  { value: 'none', label: 'None (original size)', text: 'None' },
  { value: 'scale-down', label: 'Scale down', text: 'Scale' },
];

const BOX: SegOption[] = [
  {
    value: 'content-box',
    label: 'Content box',
    text: 'Content',
    title: 'content-box: padding and border are added to the size',
  },
  {
    value: 'border-box',
    label: 'Border box',
    text: 'Border',
    title: 'border-box: padding and border are included in the size',
  },
];

@Component({
  selector: 'size-control',
  templateUrl: './size-control.component.html',
  styleUrls: ['./size-control.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SizeControlComponent),
      multi: true,
    },
  ],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CssUnitFieldComponent, OriginPadComponent, SegGroupComponent],
})
export class SizeControlComponent extends BaseControl {
  @Output() change = new EventEmitter<Partial<CSSStyleDeclaration>>();

  private readonly cd = inject(ChangeDetectorRef);

  protected readonly mainRows = MAIN_ROWS;
  protected readonly minRows = MIN_ROWS;
  protected readonly maxRows = MAX_ROWS;
  protected readonly overflow = OVERFLOW;
  protected readonly fit = FIT;
  protected readonly box = BOX;
  protected readonly units = ['px', '%', 'em', 'rem', 'vw', 'vh'] as const;
  protected readonly ratios: SegOption[] = RATIO_PRESETS.map((r) => ({
    value: r.value,
    label: r.label,
    text: r.label,
  }));
  protected readonly normalizeRatio = normalizeRatio;

  private readonly snap = signal<Partial<CSSStyleDeclaration>>({});
  protected readonly s = this.snap.asReadonly();
  /** وضعیت اولیه‌ی باز/بسته بودن بخش‌های جمع‌شونده (با writeValue تعیین می‌شود) */
  protected readonly minMaxOpen = signal(false);
  protected readonly mediaOpen = signal(false);
  protected readonly ratioInvalid = signal(false);

  protected readonly position = computed(() => parseOrigin(this.s().objectPosition) ?? { ...ORIGIN_DEFAULT });
  protected readonly ratioPreset = computed(() => {
    const v = normalizeRatio(this.s().aspectRatio);
    return RATIO_PRESETS.find((r) => normalizeRatio(r.value) === v)?.value ?? '';
  });

  writeValue(style: Partial<CSSStyleDeclaration>): void {
    this.style = style ?? {};
    const s = this.style;
    this.snap.set({ ...s });
    this.minMaxOpen.set(!!(s.minWidth || s.minHeight || s.maxWidth || s.maxHeight));
    this.mediaOpen.set(!!(s.objectFit || s.objectPosition || s.aspectRatio || s.boxSizing));
    this.ratioInvalid.set(false);
    this.cd.markForCheck();
  }

  private apply(patch: Record<string, string>): void {
    const st = this.style as unknown as Record<string, string>;
    for (const k of Object.keys(patch)) st[k] = patch[k];
    this.snap.set({ ...this.style });
    this.onChange(this.style);
    this.change.emit(this.style);
    this.cd.markForCheck();
  }

  protected value(prop: string): string {
    return (this.s() as Record<string, string | undefined>)[prop] ?? '';
  }

  protected set(prop: string, v: string): void {
    this.apply({ [prop]: v });
  }

  protected clear(prop: string): void {
    this.apply({ [prop]: '' });
  }

  protected hasAnySize(): boolean {
    const s = this.s();
    return !!(s.width || s.height || s.minWidth || s.minHeight || s.maxWidth || s.maxHeight);
  }

  protected clearSizes(): void {
    this.apply({ width: '', height: '', minWidth: '', minHeight: '', maxWidth: '', maxHeight: '' });
  }

  /** عرض/ارتفاع را با هم ۱۰۰٪ می‌کند (میان‌بر پرکاربرد) */
  protected fill(prop: 'width' | 'height'): void {
    this.apply({ [prop]: '100%' });
  }

  //---------------- aspect ratio ----------------

  protected onRatioPreset(v: string): void {
    this.ratioInvalid.set(false);
    this.apply({ aspectRatio: v });
  }

  protected onRatioText(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const v = input.value.trim();
    if (!v) {
      this.ratioInvalid.set(false);
      this.apply({ aspectRatio: '' });
      return;
    }
    if (!isValidRatio(v)) {
      this.ratioInvalid.set(true);
      return;
    }
    this.ratioInvalid.set(false);
    this.apply({ aspectRatio: normalizeRatio(v) });
  }

  //---------------- object-position ----------------

  protected onPosition(v: OriginValue): void {
    this.apply({ objectPosition: formatOrigin({ x: v.x, y: v.y }) });
  }
}
