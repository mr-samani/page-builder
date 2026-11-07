import { CommonModule } from '@angular/common';
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
import {
  FILTER_FNS,
  FILTER_META,
  FILTER_PRESETS,
  FilterFn,
  FilterItem,
  FilterMeta,
  FilterModel,
  FilterPreset,
  FilterProp,
  ShadowValue,
  cloneFilterModel,
  createFilterModel,
  createItem,
  filterDeclsToCssText,
  filterValue,
  parseFilterModel,
  serializeFilterModel,
} from 'ngx-page-builder/core';
import { CSSStyleHelper } from '../../helper/CSSStyle';
import { BaseControl } from '../base-control';

type ShadowField = 'x' | 'y' | 'blur';

interface PresetView {
  id: string;
  label: string;
  items: FilterItem[];
  /** CSS filter مقدار برای thumbnail */
  css: string;
}

/**
 * کنترل «Filter» (و با `property="backdrop-filter"` کنترل «Backdrop filter»):
 *  - فهرست مرتب‌شده‌ی تابع‌ها (blur, brightness, contrast, grayscale, hue-rotate, invert, opacity, saturate, sepia, drop-shadow)
 *    با اسلایدر + فیلد عددی، جابه‌جایی بالا/پایین و حذف
 *  - Preset ها و پیش‌نمایش زنده روی یک صحنه‌ی نمونه
 *  - تابع‌های ناشناخته (url(#id)، var(...)) بدون تغییر حفظ می‌شوند
 *
 * خروجی: فقط یک property (`filter` یا `backdrop-filter`) — به filter-model.ts نگاه کنید.
 */
@Component({
  selector: 'filter-control',
  templateUrl: './filter-control.component.html',
  styleUrls: ['./filter-control.component.scss'],
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FilterControlComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterControlComponent extends BaseControl {
  @Output() change = new EventEmitter<Partial<CSSStyleDeclaration>>();

  /** کدام property نوشته شود */
  readonly property = input<FilterProp>('filter');
  /** آیا context فعلی (breakpoint کوچک‌تر یا state) از جای دیگری ارث می‌برد؟ */
  readonly inherits = input<boolean>(false);

  private readonly cd = inject(ChangeDetectorRef);

  protected readonly fns = FILTER_FNS;
  protected readonly meta = FILTER_META;
  protected readonly model = signal<FilterModel>(createFilterModel());
  /** مقدار کنونی property هنگام لود (برای تصمیم «خاموش کردن» در context های ارث‌بر) */
  private loaded: Record<string, string> = {};

  protected readonly presets: PresetView[] = FILTER_PRESETS.map((p: FilterPreset) => {
    const items = p.build();
    return { id: p.id, label: p.label, items, css: filterValue(items) };
  });

  protected readonly items = computed(() => this.model().items);
  protected readonly hasAny = computed(() => this.items().length > 0);
  protected readonly isBackdrop = computed(() => this.property() === 'backdrop-filter');

  /** پیش‌نمایش زنده: دقیقاً همان CSS ای که روی بلاک نوشته می‌شود */
  protected readonly previewCss = computed(() =>
    filterDeclsToCssText(serializeFilterModel(this.model(), { prop: this.property(), loaded: {}, inherits: false })),
  );

  protected readonly activePreset = computed(() => {
    const cur = filterValue(this.items());
    return this.presets.find((p) => p.css === cur)?.id ?? '';
  });

  /** تابع‌هایی که هنوز در فهرست نیستند اول نشان داده می‌شوند (تکرار هم مجاز است) */
  protected readonly addable = computed(() => {
    const used = new Set(this.items().map((i) => i.fn));
    return [...this.fns].sort((a, b) => Number(used.has(a)) - Number(used.has(b)));
  });

  //---------------------------------- ControlValueAccessor ----------------------------------

  writeValue(style: Partial<CSSStyleDeclaration>): void {
    this.style = style ?? {};
    this.loaded = CSSStyleHelper.styleObjectToDecls(this.style);
    this.model.set(parseFilterModel(this.loaded[this.property()]));
    this.cd.markForCheck();
  }

  //---------------------------------- emit ----------------------------------

  private commit(): void {
    const decls = serializeFilterModel(this.model(), {
      prop: this.property(),
      loaded: this.loaded,
      inherits: this.inherits(),
    });
    Object.assign(this.style, CSSStyleHelper.declsToStyleObject(decls));
    this.onChange(this.style);
    this.change.emit(this.style);
    this.cd.markForCheck();
  }

  private update(fn: (m: FilterModel) => void): void {
    const next = cloneFilterModel(this.model());
    fn(next);
    this.model.set(next);
    this.commit();
  }

  //---------------------------------- actions ----------------------------------

  protected label(i: FilterItem): string {
    return i.kind === 'raw' ? (i.raw ?? '').replace(/\(.*$/, '()') || 'Custom' : FILTER_META[i.fn!].label;
  }

  protected metaOf(i: FilterItem): FilterMeta {
    return FILTER_META[i.fn!];
  }

  protected add(fn: FilterFn): void {
    this.update((m) => m.items.push(createItem(fn)));
  }

  protected remove(id: number): void {
    this.update((m) => (m.items = m.items.filter((i) => i.id !== id)));
  }

  protected move(id: number, dir: -1 | 1): void {
    this.update((m) => {
      const idx = m.items.findIndex((i) => i.id === id);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= m.items.length) return;
      [m.items[idx], m.items[to]] = [m.items[to], m.items[idx]];
    });
  }

  protected setValue(id: number, raw: string | number): void {
    const n = typeof raw === 'number' ? raw : parseFloat(raw);
    if (!Number.isFinite(n)) return;
    this.update((m) => {
      const it = m.items.find((i) => i.id === id);
      if (!it?.fn || it.fn === 'drop-shadow') return;
      const meta = FILTER_META[it.fn];
      // اسلایدر تا max می‌رود ولی فیلد عددی تا hardMax (یا همان max) اجازه می‌دهد
      const hi = meta.hardMax ?? (meta.unit === '%' && meta.max < 100 ? 100 : meta.max);
      it.value = Math.min(hi, Math.max(meta.min, n));
    });
  }

  protected resetItem(id: number): void {
    this.update((m) => {
      const it = m.items.find((i) => i.id === id);
      if (it?.fn && it.fn !== 'drop-shadow') it.value = FILTER_META[it.fn].neutral;
    });
  }

  protected setShadow(id: number, field: ShadowField, raw: string): void {
    const n = parseFloat(raw);
    const v = Number.isFinite(n) ? n : 0;
    this.update((m) => {
      const it = m.items.find((i) => i.id === id);
      if (it?.shadow) it.shadow = { ...it.shadow, [field]: field === 'blur' ? Math.max(0, v) : v };
    });
  }

  protected setShadowColor(id: number, hex: string): void {
    this.update((m) => {
      const it = m.items.find((i) => i.id === id);
      if (it?.shadow) it.shadow = { ...it.shadow, color: hex, colorRaw: undefined };
    });
  }

  protected setShadowAlpha(id: number, raw: string): void {
    const n = parseFloat(raw);
    this.update((m) => {
      const it = m.items.find((i) => i.id === id);
      if (it?.shadow && Number.isFinite(n)) it.shadow = { ...it.shadow, alpha: Math.min(1, Math.max(0, n / 100)) };
    });
  }

  protected shadowVal(i: FilterItem, f: string): number {
    return i.shadow![f as ShadowField];
  }

  protected shadowOf(i: FilterItem): ShadowValue {
    return i.shadow!;
  }

  protected applyPreset(p: PresetView): void {
    // id تازه می‌گیرند تا track by id با فهرست قبلی قاطی نشود
    const items = FILTER_PRESETS.find((x) => x.id === p.id)!.build();
    this.model.set({ items });
    this.commit();
  }

  protected reset(): void {
    this.model.set(createFilterModel());
    this.commit();
  }

  protected displayValue(i: FilterItem): string {
    return String(Math.round(i.value * 100) / 100);
  }
}
