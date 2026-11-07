import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  ElementRef,
  EventEmitter,
  forwardRef,
  inject,
  input,
  Output,
  signal,
  ViewChild,
} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  CORNER_KEYS,
  CORNER_PRESETS,
  CornerKey,
  CornerModel,
  CornerPreset,
  DEFAULT_INVERT_SIZE,
  DEFAULT_NOTCH,
  DEFAULT_ROUND_SIZE,
  EDGE_KEYS,
  EdgeKey,
  NotchValue,
  cloneModel,
  createModel,
  declsToCssText,
  parseCornerModel,
  pxOf,
  serializeCornerModel,
} from 'ngx-page-builder/core';
import { CSSStyleHelper } from '../../helper/CSSStyle';
import { BaseControl } from '../base-control';
import { CssUnitFieldComponent } from '../css-unit-field/css-unit-field.component';

type NotchField = 'width' | 'depth' | 'pos';

interface PresetView {
  id: string;
  label: string;
  model: CornerModel;
  /** CSS کوچک‌شده برای thumbnail */
  thumbCss: string;
}

const ROUND_UNITS = ['px', '%', 'em', 'rem'] as const;
/** گوشه‌ی وارونه با radial-gradient ساخته می‌شود، پس فقط طول مطلق معنی دارد (٪ نسبت به طول پرتو است نه المنت) */
const INVERT_UNITS = ['px', 'em', 'rem', 'vw', 'vh'] as const;

/** اندازه‌ی ثابت stage برای محاسبه‌ی handle ها (پیش‌نمایش ۱:۱ بر حسب px) */
const STAGE_H = 108;

/**
 * کنترل «Corners»:
 *  - هر گوشه: Round (border-radius) یا Inverted (گوشه‌ی فرورفته) + اندازه
 *  - Notch وسط هر لبه با عرض / عمق / موقعیت
 *  - پیش‌نمایش زنده با handle های قابل کشیدن (گوشه‌ها: کشیدن به داخل = بزرگ‌تر؛ notch: عمودی = عمق، افقی = موقعیت)
 *  - Preset ها، قفل گوشه‌ها (Linked)، و کلیدهای جهتی روی handle ها
 *
 * خروجی: `border-radius`، متغیرهای `--pb-ci-*` / `--pb-cn-*` و `mask-image` (به corner-model.ts نگاه کنید).
 */
@Component({
  selector: 'corner-control',
  templateUrl: './corner-control.component.html',
  styleUrls: ['./corner-control.component.scss'],
  standalone: true,
  imports: [CommonModule, CssUnitFieldComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CornerControlComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CornerControlComponent extends BaseControl {
  @Output() change = new EventEmitter<Partial<CSSStyleDeclaration>>();
  @ViewChild('frame') frame?: ElementRef<HTMLElement>;

  /** آیا context فعلی (breakpoint کوچک‌تر یا state) از جای دیگری ارث می‌برد؟ (روی نحوه‌ی «خاموش کردن» اثر دارد) */
  readonly inherits = input<boolean>(false);

  private readonly cd = inject(ChangeDetectorRef);

  protected readonly cornerKeys = CORNER_KEYS;
  protected readonly edgeKeys = EDGE_KEYS;
  protected readonly roundUnits = ROUND_UNITS;
  protected readonly invertUnits = INVERT_UNITS;
  protected readonly stageH = STAGE_H;
  protected readonly edgeLabel: Record<EdgeKey, string> = { t: 'Top', r: 'Right', b: 'Bottom', l: 'Left' };
  protected readonly cornerLabel: Record<CornerKey, string> = {
    tl: 'Top left',
    tr: 'Top right',
    br: 'Bottom right',
    bl: 'Bottom left',
  };

  protected readonly model = signal<CornerModel>(createModel());
  protected readonly linked = signal(true);
  protected readonly active = signal<CornerKey | null>(null);
  protected readonly shadowSet = signal(false);

  /** snapshot مقدار مؤثر هنگام لود (برای تصمیم «خاموش کردن» در context های ارث‌بر) */
  private loaded: Record<string, string> = {};

  protected readonly presets: PresetView[] = CORNER_PRESETS.map((p: CornerPreset) => {
    const model = p.build();
    return { id: p.id, label: p.label, model, thumbCss: this.thumbCss(model) };
  });

  protected readonly hasAny = computed(() => {
    const m = this.model();
    return (
      this.elliptical() ||
      CORNER_KEYS.some((k) => m.corners[k].mode === 'invert' || !this.isZero(m.corners[k].size)) ||
      EDGE_KEYS.some((e) => m.notches[e].on)
    );
  });

  protected readonly usesMask = computed(() => {
    const m = this.model();
    return CORNER_KEYS.some((k) => m.corners[k].mode === 'invert') || EDGE_KEYS.some((e) => m.notches[e].on);
  });

  protected readonly elliptical = computed(() => this.model().elliptical);

  /** پیش‌نمایش زنده: دقیقاً همان CSS ای که روی بلاک نوشته می‌شود */
  protected readonly previewCss = computed(() => {
    const d = serializeCornerModel(this.model(), { loaded: {}, inherits: false });
    return declsToCssText(d);
  });

  /** preset ی که با مدل فعلی برابر است (برای هایلایت) */
  protected readonly activePreset = computed(() => {
    const cur = JSON.stringify(this.signature(this.model()));
    return this.presets.find((p) => JSON.stringify(this.signature(p.model)) === cur)?.id ?? '';
  });

  //---------------------------------- ControlValueAccessor ----------------------------------

  writeValue(style: Partial<CSSStyleDeclaration>): void {
    this.style = style ?? {};
    this.loaded = CSSStyleHelper.styleObjectToDecls(this.style);
    const m = parseCornerModel(this.loaded);
    this.model.set(m);
    this.linked.set(this.allSame(m));
    this.shadowSet.set(!!this.loaded['box-shadow'] && this.loaded['box-shadow'] !== 'none');
    this.active.set(null);
    this.cd.markForCheck();
  }

  //---------------------------------- emit ----------------------------------

  private commit(): void {
    const decls = serializeCornerModel(this.model(), {
      loaded: this.loaded,
      inherits: this.inherits(),
      current: CSSStyleHelper.styleObjectToDecls(this.style),
    });
    Object.assign(this.style, CSSStyleHelper.declsToStyleObject(decls));
    this.onChange(this.style);
    this.change.emit(this.style);
    this.cd.markForCheck();
  }

  private update(fn: (m: CornerModel) => void): void {
    const next = cloneModel(this.model());
    fn(next);
    this.model.set(next);
    this.commit();
  }

  //---------------------------------- corners ----------------------------------

  protected corner(k: CornerKey) {
    return this.model().corners[k];
  }

  protected notch(e: EdgeKey): NotchValue {
    return this.model().notches[e];
  }

  protected unitsFor(k: CornerKey): readonly string[] {
    return this.corner(k).mode === 'invert' ? INVERT_UNITS : ROUND_UNITS;
  }

  protected setSize(k: CornerKey, size: string): void {
    this.update((m) => {
      m.elliptical = false;
      for (const key of this.targets(k)) m.corners[key].size = size || '0px';
    });
  }

  protected toggleMode(k: CornerKey): void {
    this.update((m) => {
      m.elliptical = false;
      const to = m.corners[k].mode === 'round' ? 'invert' : 'round';
      for (const key of this.targets(k)) {
        const c = m.corners[key];
        c.mode = to;
        if (to === 'invert') {
          // ٪ و صفر برای گوشه‌ی وارونه بی‌معنی/نامرئی است؛ مقدار آغازین دیدنی می‌دهیم
          if (this.isZero(c.size) || c.size.includes('%')) c.size = DEFAULT_INVERT_SIZE;
        } else if (this.isZero(c.size)) c.size = DEFAULT_ROUND_SIZE;
      }
    });
    this.active.set(k);
  }

  protected toggleLinked(): void {
    const next = !this.linked();
    this.linked.set(next);
    if (next) {
      // هم‌سان کردن با گوشه‌ی انتخاب‌شده (یا بالا-چپ)
      const src = this.active() ?? 'tl';
      this.update((m) => {
        const s = { ...m.corners[src] };
        for (const k of CORNER_KEYS) m.corners[k] = { ...s };
      });
    }
  }

  protected applyPreset(p: PresetView): void {
    const next = cloneModel(p.model);
    this.model.set(next);
    this.linked.set(this.allSame(next));
    this.active.set(null);
    this.commit();
  }

  protected reset(): void {
    this.model.set(createModel());
    this.linked.set(true);
    this.active.set(null);
    this.commit();
  }

  /** گوشه‌هایی که یک تغییر روی آن‌ها اعمال می‌شود (همه، اگر Linked) */
  private targets(k: CornerKey): readonly CornerKey[] {
    return this.linked() ? CORNER_KEYS : [k];
  }

  //---------------------------------- notches ----------------------------------

  protected toggleNotch(e: EdgeKey): void {
    this.update((m) => {
      m.notches[e] = m.notches[e].on ? { ...m.notches[e], on: false } : { ...DEFAULT_NOTCH };
    });
  }

  protected setNotch(e: EdgeKey, field: NotchField, raw: string): void {
    const n = parseFloat(raw);
    const v = Number.isFinite(n) ? Math.max(0, n) : 0;
    this.update((m) => {
      m.notches[e] = { ...m.notches[e], [field]: field === 'pos' ? Math.min(100, v) : v };
    });
  }

  //---------------------------------- stage: handles ----------------------------------

  /** اندازه‌ی گوشه بر حسب px برای جای handle (٪ به‌صورت تقریبی نسبت به ضلع کوچک) */
  private cornerPx(k: CornerKey): number {
    const c = this.corner(k);
    const px = pxOf(c.size);
    if (px != null) return px;
    const pct = /^(\d*\.?\d+)%$/.exec(c.size.trim());
    if (pct) return (parseFloat(pct[1]) / 100) * STAGE_H;
    const rem = /^(\d*\.?\d+)(rem|em)$/.exec(c.size.trim());
    return rem ? parseFloat(rem[1]) * 16 : 0;
  }

  protected handleStyle(k: CornerKey): Record<string, string> {
    const s = Math.min(this.cornerPx(k), STAGE_H / 2) + 'px';
    return {
      [k[1] === 'l' ? 'left' : 'right']: s,
      [k[0] === 't' ? 'top' : 'bottom']: s,
    };
  }

  protected notchHandleStyle(e: EdgeKey): Record<string, string> {
    const n = this.notch(e);
    const d = Math.min(n.depth, STAGE_H * 0.9) + 'px';
    const p = n.pos + '%';
    switch (e) {
      case 't':
        return { left: p, top: d };
      case 'b':
        return { left: p, bottom: d };
      case 'l':
        return { left: d, top: p };
      default:
        return { right: d, top: p };
    }
  }

  private drag: { type: 'corner'; k: CornerKey } | { type: 'notch'; e: EdgeKey } | null = null;

  protected onCornerDown(ev: PointerEvent, k: CornerKey): void {
    ev.preventDefault();
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    this.drag = { type: 'corner', k };
    this.active.set(k);
    this.onMove(ev);
  }

  protected onNotchDown(ev: PointerEvent, e: EdgeKey): void {
    ev.preventDefault();
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    this.drag = { type: 'notch', e };
    this.onMove(ev);
  }

  protected onMove(ev: PointerEvent): void {
    const d = this.drag;
    const box = this.frame?.nativeElement.getBoundingClientRect();
    if (!d || !box) return;
    const px = ev.clientX - box.left;
    const py = ev.clientY - box.top;
    const W = box.width;
    const H = box.height;

    if (d.type === 'corner') {
      const dx = d.k[1] === 'l' ? px : W - px;
      const dy = d.k[0] === 't' ? py : H - py;
      const max = Math.min(W, H) / 2;
      const s = Math.round(Math.max(0, Math.min(max, (dx + dy) / 2)));
      const all = ev.shiftKey;
      this.update((m) => {
        m.elliptical = false;
        for (const key of all || this.linked() ? CORNER_KEYS : [d.k]) m.corners[key].size = `${s}px`;
      });
    } else {
      const e = d.e;
      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
      const depth = e === 't' ? py : e === 'b' ? H - py : e === 'l' ? px : W - px;
      const along = e === 't' || e === 'b' ? px / W : py / H;
      const dMax = (e === 't' || e === 'b' ? H : W) * 0.9;
      this.update((m) => {
        m.notches[e] = {
          ...m.notches[e],
          depth: Math.round(clamp(depth, 0, dMax)),
          pos: Math.round(clamp(along * 100, 0, 100)),
        };
      });
    }
  }

  protected onUp(ev: PointerEvent): void {
    const el = ev.currentTarget as HTMLElement;
    if (el.hasPointerCapture?.(ev.pointerId)) el.releasePointerCapture(ev.pointerId);
    this.drag = null;
  }

  /** ← → ↑ ↓ روی handle: ±۱px (Shift: ±۱۰) */
  protected onCornerKey(ev: KeyboardEvent, k: CornerKey): void {
    const step = ev.shiftKey ? 10 : 1;
    const dir = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    ev.preventDefault();
    const s = Math.max(0, Math.round(this.cornerPx(k) + dir * step));
    this.setSize(k, `${s}px`);
  }

  protected addNotch(e: EdgeKey): void {
    if (!this.notch(e).on) this.toggleNotch(e);
  }

  //---------------------------------- helpers ----------------------------------

  private isZero(v: string): boolean {
    return !v.trim() || /^0+(\.0+)?[a-z%]*$/i.test(v.trim());
  }

  private allSame(m: CornerModel): boolean {
    const a = m.corners.tl;
    return CORNER_KEYS.every((k) => m.corners[k].mode === a.mode && m.corners[k].size === a.size);
  }

  /** ساختار قابل مقایسه‌ی مدل (برای تشخیص preset فعال) */
  private signature(m: CornerModel) {
    return {
      c: CORNER_KEYS.map((k) => [m.corners[k].mode, pxOf(m.corners[k].size) ?? m.corners[k].size]),
      n: EDGE_KEYS.map((e) => (m.notches[e].on ? [m.notches[e].width, m.notches[e].depth, m.notches[e].pos] : 0)),
    };
  }

  /** thumbnail کوچک preset (۳۶×۲۴): اندازه‌ها متناسب کوچک می‌شوند تا شکل خوانا بماند */
  private thumbCss(m: CornerModel): string {
    const t = cloneModel(m);
    const k = 0.45;
    for (const key of CORNER_KEYS) {
      const px = pxOf(t.corners[key].size);
      t.corners[key].size = px != null ? `${Math.min(px * k, 12)}px` : '4px';
    }
    for (const e of EDGE_KEYS) {
      t.notches[e].width = t.notches[e].width * k;
      t.notches[e].depth = Math.min(t.notches[e].depth * k, 8);
    }
    return declsToCssText(serializeCornerModel(t, { loaded: {}, inherits: false }));
  }
}
