import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  forwardRef,
  inject,
  Output,
  computed,
  input,
  signal,
} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { BaseControl } from '../base-control';
import { CssUnitFieldComponent } from '../css-unit-field/css-unit-field.component';
import { SegGroupComponent, SegOption } from '../seg-group/seg-group.component';
import { GridTracksComponent } from './grid-tracks.component';
import {
  DistKind,
  FLEX_PRESETS,
  FlexSizing,
  GRID_PRESETS,
  alignGlyph,
  detectSizing,
  effectiveFlex,
  findGridPreset,
  isVertical,
  justifyGlyph,
  normalizePos,
  padPosition,
  padToValues,
  parseGap,
  parseSpan,
  parseTracks,
  spanValue,
  trackWeight,
} from './display-model';
import type { Rect } from './display-model';

export type DisplayType =
  | 'block'
  | 'inline'
  | 'inline-block'
  | 'flex'
  | 'inline-flex'
  | 'grid'
  | 'inline-grid'
  | 'table'
  | 'table-row'
  | 'table-cell'
  | 'none'
  | 'contents'
  | 'flow-root';

type StyleKey = string;

const R = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

const DISPLAY_MAIN: SegOption[] = [
  { value: 'block', label: 'Block', rects: [R(2, 2, 12, 3.2), R(2, 6.4, 12, 3.2), R(2, 10.8, 12, 3.2)] },
  { value: 'flex', label: 'Flex', rects: [R(2, 3, 3.2, 10), R(6.4, 3, 3.2, 10), R(10.8, 3, 3.2, 10)] },
  { value: 'grid', label: 'Grid', rects: [R(2, 2, 5.5, 5.5), R(8.5, 2, 5.5, 5.5), R(2, 8.5, 5.5, 5.5), R(8.5, 8.5, 5.5, 5.5)] },
  { value: 'inline', label: 'Inline', rects: [R(1.5, 7, 4, 2), R(6.5, 7, 3, 2), R(10.5, 7, 4, 2), R(1.5, 3, 13, 1), R(1.5, 12, 13, 1)] },
  {
    value: 'none',
    label: 'None',
    title: 'None (hidden)',
    paths: ['M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z', 'M4.1 11.9l7.8-7.8'],
  },
];

const DISPLAY_MORE: { value: DisplayType; label: string }[] = [
  { value: 'inline-block', label: 'Inline block' },
  { value: 'inline-flex', label: 'Inline flex' },
  { value: 'inline-grid', label: 'Inline grid' },
  { value: 'flow-root', label: 'Flow root' },
  { value: 'contents', label: 'Contents' },
  { value: 'table', label: 'Table' },
  { value: 'table-row', label: 'Table row' },
  { value: 'table-cell', label: 'Table cell' },
];
const MORE_VALUES = new Set<string>(DISPLAY_MORE.map((d) => d.value));

const DIRECTION: SegOption[] = [
  { value: 'row', label: 'Row', title: 'Row →', paths: ['M2 8h11', 'M9.5 4.5L13 8l-3.5 3.5'] },
  { value: 'column', label: 'Column', title: 'Column ↓', paths: ['M8 2v11', 'M4.5 9.5L8 13l3.5-3.5'] },
  { value: 'row-reverse', label: 'Row reverse', title: 'Row reverse ←', paths: ['M14 8H3', 'M6.5 4.5L3 8l3.5 3.5'] },
  { value: 'column-reverse', label: 'Column reverse', title: 'Column reverse ↑', paths: ['M8 14V3', 'M4.5 6.5L8 3l3.5 3.5'] },
];

const WRAP: SegOption[] = [
  { value: 'nowrap', label: 'No wrap', rects: [R(2, 6, 3.2, 4), R(6.4, 6, 3.2, 4), R(10.8, 6, 3.2, 4)] },
  { value: 'wrap', label: 'Wrap', rects: [R(2, 3, 3.2, 4), R(6.4, 3, 3.2, 4), R(10.8, 3, 3.2, 4), R(2, 9, 3.2, 4), R(6.4, 9, 3.2, 4)] },
  {
    value: 'wrap-reverse',
    label: 'Wrap reverse',
    rects: [R(2, 9, 3.2, 4), R(6.4, 9, 3.2, 4), R(10.8, 9, 3.2, 4), R(2, 3, 3.2, 4), R(6.4, 3, 3.2, 4)],
  },
];

const JUSTIFY_KINDS: { v: DistKind; label: string }[] = [
  { v: 'flex-start', label: 'Start' },
  { v: 'center', label: 'Center' },
  { v: 'flex-end', label: 'End' },
  { v: 'space-between', label: 'Space between' },
  { v: 'space-around', label: 'Space around' },
  { v: 'space-evenly', label: 'Space evenly' },
];
const ALIGN_KINDS: { v: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline'; label: string }[] = [
  { v: 'flex-start', label: 'Start' },
  { v: 'center', label: 'Center' },
  { v: 'flex-end', label: 'End' },
  { v: 'stretch', label: 'Stretch' },
  { v: 'baseline', label: 'Baseline' },
];
const CONTENT_KINDS: { v: DistKind; label: string }[] = [...JUSTIFY_KINDS, { v: 'stretch', label: 'Stretch' }];

const SIZING: SegOption[] = [
  { value: 'fixed', label: "Don't grow or shrink", text: 'Fixed', title: "Don't grow or shrink  (0 0 auto)" },
  { value: 'shrink', label: 'Shrink if needed', text: 'Shrink', title: 'Shrink if needed  (0 1 auto)' },
  { value: 'grow', label: 'Grow if possible', text: 'Grow', title: 'Grow if possible  (1 1 0%)' },
  { value: 'custom', label: 'Custom', text: 'Custom' },
];

const ORDER: SegOption[] = [
  { value: '-1', label: 'First', text: 'First', title: 'First  (order: -1)' },
  { value: '1', label: 'Last', text: 'Last', title: 'Last  (order: 1)' },
];

const SELF_KINDS = [{ v: 'auto', label: 'Auto' }, ...ALIGN_KINDS] as const;
const GRID_ITEMS: SegOption[] = [
  { value: 'start', label: 'Start', rects: alignGlyph('flex-start').slice(0, 3) },
  { value: 'center', label: 'Center', rects: alignGlyph('center') },
  { value: 'end', label: 'End', rects: alignGlyph('flex-end') },
  { value: 'stretch', label: 'Stretch', rects: alignGlyph('stretch') },
];
const GRID_FLOW: SegOption[] = [
  { value: 'row', label: 'Row', text: 'Row' },
  { value: 'column', label: 'Column', text: 'Column' },
  { value: 'row dense', label: 'Row dense', text: 'Dense', title: 'Row, dense packing' },
  { value: 'column dense', label: 'Column dense', text: 'Col dense', title: 'Column, dense packing' },
];

const toGridPos = (v: string): string => {
  const n = normalizePos(v);
  return n === 'flex-start' ? 'start' : n === 'flex-end' ? 'end' : n;
};

@Component({
  selector: 'display-control',
  templateUrl: './display-control.component.html',
  styleUrls: ['./display-control.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DisplayControlComponent),
      multi: true,
    },
  ],
  standalone: true,
  imports: [NgTemplateOutlet, SegGroupComponent, CssUnitFieldComponent, GridTracksComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisplayControlComponent extends BaseControl {
  @Output() change = new EventEmitter<Partial<CSSStyleDeclaration>>();

  /** display «محاسبه‌شده‌ی» خود المان (از کلاس‌ها / Bootstrap)؛ وقتی کاربر خودش ست نکرده راهنماست */
  computedDisplay = input<string>('');
  /** display والد: 'flex' | 'grid' | ... ؛ undefined = والدی نیست / نامعلوم */
  parentDisplay = input<string | undefined>(undefined);
  /** flex-direction والد (برای جهت آیکن‌های align-self) */
  parentFlexDirection = input<string>('row');

  private readonly cd = inject(ChangeDetectorRef);

  protected readonly displayMain = DISPLAY_MAIN;
  protected readonly displayMore = DISPLAY_MORE;
  protected readonly direction = DIRECTION;
  protected readonly wrap = WRAP;
  protected readonly sizing = SIZING;
  protected readonly order = ORDER;
  protected readonly gridItems = GRID_ITEMS;
  protected readonly gridFlow = GRID_FLOW;
  protected readonly presets = GRID_PRESETS.map<SegOption>((p) => ({ value: p.id, label: p.label, text: p.label, title: p.columns }));
  protected readonly lengthUnits = ['px', '%', 'em', 'rem', 'vw', 'vh'] as const;
  protected readonly normalizePos = normalizePos;
  protected readonly normalizeGrid = toGridPos;
  protected readonly padCells = [0, 1, 2, 3, 4, 5, 6, 7, 8];

  /** نسخه‌ی فعلی style برای signal ها (style خودش ساده‌ی mutate‌شونده است) */
  private readonly snap = signal<Partial<CSSStyleDeclaration>>({});
  protected readonly s = this.snap.asReadonly();
  protected readonly gapSplit = signal(false);
  private readonly customSizing = signal(false);

  protected readonly eff = computed(() => (this.s().display || this.computedDisplay() || '').trim());
  isFlex = computed(() => this.eff() === 'flex' || this.eff() === 'inline-flex');
  isGrid = computed(() => this.eff() === 'grid' || this.eff() === 'inline-grid');
  isTable = computed(() => this.eff().includes('table'));
  protected readonly parentKind = computed<'flex' | 'grid' | 'other' | 'none'>(() => {
    const p = this.parentDisplay();
    if (p === undefined) return 'none';
    if (p === 'flex' || p === 'inline-flex') return 'flex';
    if (p === 'grid' || p === 'inline-grid') return 'grid';
    return 'other';
  });

  protected readonly moreSelected = computed(() => (MORE_VALUES.has(this.s().display ?? '') ? this.s().display! : ''));

  //---------------- flex container ----------------

  protected readonly dir = computed(() => this.s().flexDirection || 'row');
  protected readonly vertical = computed(() => isVertical(this.dir()));
  protected readonly padCell = computed(() => padPosition(this.dir(), this.s().justifyContent, this.s().alignItems));
  protected readonly justifyOpts = computed<SegOption[]>(() =>
    JUSTIFY_KINDS.map((k) => ({ value: k.v, label: k.label, rects: justifyGlyph(k.v, this.vertical()) })),
  );
  protected readonly alignOpts = computed<SegOption[]>(() =>
    ALIGN_KINDS.map((k) => ({ value: k.v, label: k.label, rects: alignGlyph(k.v, this.vertical()) })),
  );
  /** align-content روی محور فرعی است → عمود بر justify */
  protected readonly contentOpts = computed<SegOption[]>(() =>
    CONTENT_KINDS.map((k) => ({ value: k.v, label: k.label, rects: justifyGlyph(k.v, !this.vertical()) })),
  );
  protected readonly isWrapped = computed(() => !!this.s().flexWrap && this.s().flexWrap !== 'nowrap');

  //---------------- grid container ----------------

  protected readonly gridPreset = computed(() => findGridPreset(this.s().gridTemplateColumns)?.id ?? '');
  /** justify-content / align-content در grid: مقدارها start/end (نه flex-start) */
  private gridDist(vertical: boolean): SegOption[] {
    const map: { value: string; label: string; glyph: DistKind }[] = [
      { value: 'start', label: 'Start', glyph: 'flex-start' },
      { value: 'center', label: 'Center', glyph: 'center' },
      { value: 'end', label: 'End', glyph: 'flex-end' },
      { value: 'space-between', label: 'Space between', glyph: 'space-between' },
      { value: 'space-around', label: 'Space around', glyph: 'space-around' },
      { value: 'space-evenly', label: 'Space evenly', glyph: 'space-evenly' },
      { value: 'stretch', label: 'Stretch', glyph: 'stretch' },
    ];
    return map.map((m) => ({ value: m.value, label: m.label, rects: justifyGlyph(m.glyph, vertical) }));
  }
  protected readonly gridJustifyOpts = this.gridDist(false);
  protected readonly gridAlignContentOpts = this.gridDist(true);

  /** پیش‌نمایش کوچک grid: وزن track ها (نه محاسبه‌ی واقعی) */
  protected readonly preview = computed(() => {
    const cols = parseTracks(this.s().gridTemplateColumns);
    const rows = parseTracks(this.s().gridTemplateRows);
    if (cols === null || rows === null) return null; // قالب پیشرفته
    const c = cols.length ? cols.map((t) => `${trackWeight(t.value)}fr`) : ['1fr'];
    const r = rows.length ? rows.map((t) => `${trackWeight(t.value)}fr`) : ['1fr'];
    const n = Math.min(c.length * r.length, 144);
    return { columns: c.join(' '), rows: r.join(' '), cells: Array.from({ length: n }, (_, i) => i) };
  });

  //---------------- child ----------------

  protected readonly flexInfo = computed(() => effectiveFlex(this.s()));
  protected readonly flexSizing = computed<FlexSizing | ''>(() => {
    if (this.customSizing()) return 'custom';
    const f = this.flexInfo();
    return f.isSet ? detectSizing(f.parts) : '';
  });
  protected readonly selfOpts = computed<SegOption[]>(() =>
    SELF_KINDS.map((k) => ({
      value: k.v,
      label: k.label,
      ...(k.v === 'auto' ? { text: 'Auto' } : { rects: alignGlyph(k.v, isVertical(this.parentFlexDirection())) }),
    })),
  );
  protected readonly colSpan = computed(() => parseSpan(this.s().gridColumn));
  protected readonly rowSpan = computed(() => parseSpan(this.s().gridRow));

  //==================================================================================
  // ControlValueAccessor
  //==================================================================================

  writeValue(style: Partial<CSSStyleDeclaration>): void {
    this.style = style ?? {};
    this.snap.set({ ...this.style });
    this.gapSplit.set(parseGap(this.style).split);
    this.customSizing.set(false);
    this.cd.markForCheck();
  }

  //==================================================================================
  // write helpers
  //==================================================================================

  /** چند property را یک‌جا می‌نویسد ('' = حذف override) و یک بار emit می‌کند */
  private apply(patch: Record<StyleKey, string>): void {
    const st = this.style as unknown as Record<string, string>;
    for (const k of Object.keys(patch)) st[k] = patch[k];
    this.snap.set({ ...this.style });
    this.onChange(this.style);
    this.change.emit(this.style);
    this.cd.markForCheck();
  }

  protected presetColumns(id: string): string {
    return GRID_PRESETS.find((p) => p.id === id)?.columns ?? '';
  }

  protected setProp(prop: StyleKey, value: string): void {
    this.apply({ [prop]: value });
  }

  /** property + هم‌ارزهای shorthand که باید پاک شوند */
  protected setGridPos(prop: 'alignItems' | 'justifyItems' | 'justifyContent' | 'alignContent', value: string): void {
    this.apply({ [prop]: value });
  }

  //---------------- display ----------------

  protected onDisplay(value: string): void {
    const patch: Record<StyleKey, string> = { display: value };
    // مثل Webflow: grid بدون template یک شبکه‌ی ۲×۲ می‌گیرد تا کاربر همان لحظه چیزی ببیند
    if (value === 'grid' || value === 'inline-grid') {
      if (!this.s().gridTemplateColumns) patch['gridTemplateColumns'] = '1fr 1fr';
      if (!this.s().gridTemplateRows) patch['gridTemplateRows'] = 'auto auto';
    }
    this.apply(patch);
  }

  protected onMoreDisplay(ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value;
    if (v) this.onDisplay(v);
  }

  //---------------- flex pad ----------------

  protected padOn(i: number): boolean {
    const c = this.padCell();
    return !!c && c.col === i % 3 && c.row === Math.floor(i / 3);
  }

  protected onPad(i: number): void {
    if (this.padOn(i)) {
      this.apply({ justifyContent: '', alignItems: '' });
      return;
    }
    const v = padToValues(this.dir(), i % 3, Math.floor(i / 3));
    this.apply({ justifyContent: v.justify, alignItems: v.align });
  }

  //---------------- gap ----------------

  protected gap = computed(() => parseGap(this.s()));

  protected setGap(v: string): void {
    this.apply({ gap: v, rowGap: '', columnGap: '' });
  }

  protected setGapAxis(axis: 'row' | 'col', v: string): void {
    const g = this.gap();
    const row = axis === 'row' ? v : g.row;
    const col = axis === 'col' ? v : g.col;
    this.apply({ gap: '', rowGap: row, columnGap: col });
  }

  protected toggleGapSplit(): void {
    const next = !this.gapSplit();
    this.gapSplit.set(next);
    const g = this.gap();
    if (next) {
      if (g.row || g.col) this.apply({ gap: '', rowGap: g.row, columnGap: g.col || g.row });
    } else if (g.row || g.col) {
      // دوباره یکی: مقدار row به هر دو می‌رسد
      this.apply({ gap: g.row || g.col, rowGap: '', columnGap: '' });
    }
  }

  //---------------- flex child ----------------

  protected onSizing(v: string): void {
    if (v === '') {
      this.customSizing.set(false);
      this.apply({ flex: '', flexGrow: '', flexShrink: '', flexBasis: '' });
      return;
    }
    if (v === 'custom') {
      this.customSizing.set(true);
      // مقدار فعلی را صریح می‌نویسیم تا فیلدها پر باشند
      const p = this.flexInfo().parts;
      this.apply({ flex: '', flexGrow: p.grow, flexShrink: p.shrink, flexBasis: p.basis });
      return;
    }
    this.customSizing.set(false);
    const p = FLEX_PRESETS[v as Exclude<FlexSizing, 'custom'>];
    this.apply({ flex: '', flexGrow: p.grow, flexShrink: p.shrink, flexBasis: p.basis });
  }

  protected setFlexPart(part: 'flexGrow' | 'flexShrink' | 'flexBasis', v: string): void {
    // اگر shorthand بوده، همه‌ی جزءها را صریح به longhand می‌بریم تا چیزی گم نشود
    const p = this.flexInfo().parts;
    this.apply({ flex: '', flexGrow: p.grow, flexShrink: p.shrink, flexBasis: p.basis, [part]: v });
  }

  //---------------- grid child ----------------

  protected spanText(n: number | null): string {
    return n === 0 ? 'Auto' : n === null ? 'Custom' : `Span ${n}`;
  }

  protected stepSpan(prop: 'gridColumn' | 'gridRow', dir: -1 | 1): void {
    const cur = parseSpan(this.s()[prop]) ?? 0;
    const next = Math.min(24, Math.max(0, cur + dir));
    this.apply({ [prop]: spanValue(next) });
  }

  //---------------- misc ----------------

  protected hasAnyFlexChild(): boolean {
    const s = this.s();
    return !!(s.flex || s.flexGrow || s.flexShrink || s.flexBasis || s.alignSelf || s.order);
  }

  protected clearFlexChild(): void {
    this.customSizing.set(false);
    this.apply({ flex: '', flexGrow: '', flexShrink: '', flexBasis: '', alignSelf: '', order: '' });
  }

  protected clearGridChild(): void {
    this.apply({ gridColumn: '', gridRow: '', justifySelf: '', alignSelf: '' });
  }
}
