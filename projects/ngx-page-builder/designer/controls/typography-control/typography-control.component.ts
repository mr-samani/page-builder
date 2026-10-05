import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Output,
  computed,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { BaseControl } from '../base-control';
import { ClassManagerService } from '../../services/class-manager.service';
import { CssUnitFieldComponent } from '../css-unit-field/css-unit-field.component';
import { resolveCssVars } from '../css-unit-field/css-value-utils';
import { CssVarPickerComponent } from '../css-var-picker/css-var-picker.component';
import { InputCssComponent } from '../input-css/input-css.component';
import { SegGroupComponent, SegOption } from '../seg-group/seg-group.component';
import type { Rect } from '../display-control/display-model';
import { NGX_PAGE_BUILDER_FONTS } from './fonts.token';
import {
  DEFAULT_FONTS,
  FontOption,
  WEIGHTS,
  colorLuminance,
  effectiveDecorationLine,
  findFont,
  firstFamily,
  fontLabelOf,
  isTruncated,
  isVarValue,
  normalizeWeight,
  physicalAlign,
} from './typography-model';

const CUSTOM = '__custom__';
const R = (x: number, y: number, w: number, h = 1.6): Rect => ({ x, y, w, h });

const ALIGN: SegOption[] = [
  { value: 'left', label: 'Left', rects: [R(2, 3, 12), R(2, 6.2, 8), R(2, 9.4, 12), R(2, 12.6, 6)] },
  { value: 'center', label: 'Center', rects: [R(2, 3, 12), R(4, 6.2, 8), R(2, 9.4, 12), R(5, 12.6, 6)] },
  { value: 'right', label: 'Right', rects: [R(2, 3, 12), R(6, 6.2, 8), R(2, 9.4, 12), R(8, 12.6, 6)] },
  { value: 'justify', label: 'Justify', rects: [R(2, 3, 12), R(2, 6.2, 12), R(2, 9.4, 12), R(2, 12.6, 12)] },
];

const FONT_STYLE: SegOption[] = [
  { value: 'normal', label: 'Normal', text: 'Normal' },
  { value: 'italic', label: 'Italic', paths: ['M7 3h5', 'M4 13h5', 'M10 3L6 13'] },
];

const DECORATION: SegOption[] = [
  { value: 'none', label: 'None', paths: ['M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z', 'M4.1 11.9l7.8-7.8'] },
  { value: 'underline', label: 'Underline', paths: ['M4.5 2v6a3.5 3.5 0 0 0 7 0V2', 'M3 14h10'] },
  { value: 'overline', label: 'Overline', paths: ['M3 2h10', 'M4.5 5v4.5a3.5 3.5 0 0 0 7 0V5'] },
  {
    value: 'line-through',
    label: 'Line through',
    paths: ['M10.8 4.6C10.3 3 6.2 2.8 5.8 5.2 5.5 7.4 10.6 7.9 10.3 10.5 10 13.1 5.9 13.2 5.2 11', 'M2.5 8h11'],
  },
];

const TRANSFORM: SegOption[] = [
  { value: 'none', label: 'None', text: '–' },
  { value: 'uppercase', label: 'Uppercase', text: 'AA' },
  { value: 'lowercase', label: 'Lowercase', text: 'aa' },
  { value: 'capitalize', label: 'Capitalize', text: 'Aa' },
];

const DIRECTION: SegOption[] = [
  { value: 'ltr', label: 'Left to right', text: 'LTR' },
  { value: 'rtl', label: 'Right to left', text: 'RTL' },
];

const WHITE_SPACE: SegOption[] = [
  { value: 'normal', label: 'Normal', text: 'Normal' },
  { value: 'nowrap', label: 'No wrap', text: 'No wrap' },
  { value: 'pre', label: 'Pre', text: 'Pre' },
  { value: 'pre-wrap', label: 'Pre wrap', text: 'Pre wrap' },
  { value: 'pre-line', label: 'Pre line', text: 'Pre line' },
  { value: 'break-spaces', label: 'Break spaces', text: 'Spaces' },
];

const WORD_BREAK: SegOption[] = [
  { value: 'normal', label: 'Normal', text: 'Normal' },
  { value: 'break-word', label: 'Break long words (overflow-wrap: break-word)', text: 'Break word' },
  { value: 'anywhere', label: 'Break anywhere (overflow-wrap: anywhere)', text: 'Anywhere' },
];

@Component({
  selector: 'typography-control',
  templateUrl: './typography-control.component.html',
  styleUrls: ['./typography-control.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TypographyControlComponent),
      multi: true,
    },
  ],
  standalone: true,
  imports: [FormsModule, CssUnitFieldComponent, CssVarPickerComponent, InputCssComponent, SegGroupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypographyControlComponent extends BaseControl {
  @Output() change = new EventEmitter<Partial<CSSStyleDeclaration>>();

  /**
   * مقدارهای محاسبه‌شده‌ی مرورگر برای این المان (fontSize, color, ...). فیلدهای ست‌نشده با آن‌ها
   * placeholder می‌گیرند و پیش‌نمایش درست است — حتی وقتی مقدار از کلاس یا ارث‌بری می‌آید.
   */
  computedStyle = input<Record<string, string>>({});

  private readonly cd = inject(ChangeDetectorRef);
  private readonly cls = inject(ClassManagerService);
  private readonly projectFonts = inject(NGX_PAGE_BUILDER_FONTS, { optional: true }) ?? [];

  protected readonly customKey = CUSTOM;
  protected readonly weights = WEIGHTS;
  protected readonly align = ALIGN;
  protected readonly fontStyle = FONT_STYLE;
  protected readonly decoration = DECORATION;
  protected readonly transform = TRANSFORM;
  protected readonly directionOpts = DIRECTION;
  protected readonly whiteSpace = WHITE_SPACE;
  protected readonly wordBreak = WORD_BREAK;
  protected readonly sizeUnits = ['px', 'em', 'rem', '%', 'vw', 'vh'] as const;
  protected readonly lineUnits = ['', 'px', 'em', 'rem', '%'] as const;
  protected readonly spaceUnits = ['px', 'em', 'rem'] as const;
  protected readonly indentUnits = ['px', 'em', 'rem', '%'] as const;
  protected readonly normalizeWeight = normalizeWeight;

  private readonly snap = signal<Partial<CSSStyleDeclaration>>({});
  protected readonly s = this.snap.asReadonly();
  protected readonly customFont = signal(false);

  /** لیست کامل فونت‌ها: فونت‌های پروژه اول */
  protected readonly fonts: FontOption[] = [...this.projectFonts, ...DEFAULT_FONTS];
  protected readonly fontGroups = (() => {
    const map = new Map<string, FontOption[]>();
    for (const f of this.fonts) {
      if (!map.has(f.group)) map.set(f.group, []);
      map.get(f.group)!.push(f);
    }
    return Array.from(map, ([label, items]) => ({ label, items }));
  })();

  protected c = (k: string): string => this.computedStyle()[k] ?? '';

  //---------------- font family ----------------

  protected readonly fontChoice = computed(() => {
    const v = (this.s().fontFamily ?? '').trim();
    if (!v) return this.customFont() ? CUSTOM : '';
    if (this.customFont() || isVarValue(v)) return CUSTOM;
    return findFont(this.fonts, v)?.value ?? CUSTOM;
  });
  protected readonly inheritedFontLabel = computed(() => fontLabelOf(this.c('fontFamily')) || 'default');

  //---------------- weight ----------------

  protected readonly weightValue = computed(() => normalizeWeight(this.s().fontWeight));
  protected readonly weightIsExtra = computed(() => {
    const w = this.weightValue();
    return !!w && !WEIGHTS.some((x) => x.value === w);
  });
  protected readonly weightHint = computed(() => {
    const w = normalizeWeight(this.c('fontWeight'));
    return WEIGHTS.find((x) => x.value === w)?.label ?? w;
  });

  //---------------- derived values ----------------

  protected readonly direction = computed(() => this.s().direction || this.c('direction') || 'ltr');
  protected readonly alignValue = computed(() => physicalAlign(this.s().textAlign, this.direction()));
  protected readonly alignInherited = computed(() => physicalAlign(this.c('textAlign'), this.direction()));
  protected readonly decorationLine = computed(() => effectiveDecorationLine(this.s()));
  protected readonly decorationInherited = computed(
    () => effectiveDecorationLine({ textDecorationLine: this.c('textDecorationLine') }) || 'none',
  );
  protected readonly truncated = computed(() => isTruncated(this.s()));
  protected readonly lineHeightHint = computed(() => this.c('lineHeight'));

  /** پیش‌نمایش: مقدار ست‌شده، وگرنه محاسبه‌شده؛ var() ها حل می‌شوند */
  protected readonly pv = computed(() => {
    const s = this.s();
    const pick = (k: keyof CSSStyleDeclaration & string) =>
      resolveCssVars(((s[k] as string | undefined) || this.c(k)).toString(), this.cls.cssVariables);
    const size = pick('fontSize');
    const color = pick('color');
    const lum = colorLuminance(color);
    return {
      fontFamily: pick('fontFamily') || 'inherit',
      fontSize: size ? `min(max(${size}, 12px), 40px)` : '18px',
      fontWeight: pick('fontWeight') || '400',
      fontStyle: pick('fontStyle') || 'normal',
      lineHeight: pick('lineHeight') || 'normal',
      letterSpacing: pick('letterSpacing') || 'normal',
      color: color || '#e8e8ea',
      textTransform: pick('textTransform') || 'none',
      textDecoration:
        ((s.textDecorationLine || s.textDecoration || this.c('textDecorationLine')) ?? '').toString() || 'none',
      direction: this.direction(),
      // متن تیره روی زمینه‌ی روشن، متن روشن روی زمینه‌ی تیره
      stage: lum !== null && lum < 0.4 ? '#f1f1f4' : '#121214',
    };
  });

  //==================================================================================

  writeValue(style: Partial<CSSStyleDeclaration>): void {
    this.style = style ?? {};
    this.snap.set({ ...this.style });
    // اگر فونت ذخیره‌شده در لیست نیست، مستقیماً در حالت Custom باز شود
    const f = (this.style.fontFamily ?? '').trim();
    this.customFont.set(!!f && !isVarValue(f) && !findFont(this.fonts, f));
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

  protected setProp(prop: string, value: string | undefined): void {
    this.apply({ [prop]: value ?? '' });
  }

  protected hasAny(): boolean {
    const s = this.s();
    return !!(
      s.fontFamily ||
      s.fontSize ||
      s.fontWeight ||
      s.fontStyle ||
      s.lineHeight ||
      s.color ||
      s.textAlign ||
      s.textDecoration ||
      s.textDecorationLine ||
      s.textTransform ||
      s.letterSpacing ||
      s.wordSpacing ||
      s.textIndent ||
      s.direction ||
      s.whiteSpace ||
      s.overflowWrap ||
      s.textOverflow
    );
  }

  protected clearAll(): void {
    this.customFont.set(false);
    this.apply({
      fontFamily: '',
      fontSize: '',
      fontWeight: '',
      fontStyle: '',
      lineHeight: '',
      color: '',
      textAlign: '',
      textDecoration: '',
      textDecorationLine: '',
      textTransform: '',
      letterSpacing: '',
      wordSpacing: '',
      textIndent: '',
      direction: '',
      whiteSpace: '',
      overflowWrap: '',
      textOverflow: '',
    });
  }

  //---------------- font ----------------

  protected onFont(ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value;
    if (v === CUSTOM) {
      this.customFont.set(true);
      this.cd.markForCheck();
      return;
    }
    this.customFont.set(false);
    this.apply({ fontFamily: v });
  }

  protected onFontText(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value.trim();
    this.apply({ fontFamily: v });
    if (!v) this.customFont.set(false);
  }

  protected onFontVar(v: string): void {
    this.customFont.set(true);
    this.apply({ fontFamily: v });
  }

  protected fontHint(): string {
    return firstFamily(this.s().fontFamily) ? '' : this.inheritedFontLabel();
  }

  protected onWeight(ev: Event): void {
    this.apply({ fontWeight: (ev.target as HTMLSelectElement).value });
  }

  //---------------- decoration / truncate ----------------

  protected onDecoration(v: string): void {
    // longhand می‌نویسیم و shorthand قدیمی را پاک می‌کنیم تا دو منبع حقیقت نداشته باشیم
    this.apply({ textDecorationLine: v, textDecoration: '' });
  }

  protected toggleTruncate(): void {
    if (this.truncated()) this.apply({ textOverflow: '', whiteSpace: '', overflow: '' });
    else this.apply({ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' });
  }
}
