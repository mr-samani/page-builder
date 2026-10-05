import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  forwardRef,
  inject,
  Output,
  signal,
  computed,
  ViewChild,
} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { BaseControl } from '../base-control';
import { ClassManagerService } from '../../services/class-manager.service';
import { CssUnitFieldComponent } from '../css-unit-field/css-unit-field.component';
import { resolveCssVars } from '../css-unit-field/css-value-utils';
import { OriginPadComponent, OriginValue } from '../origin-pad/origin-pad.component';
import { PbPopoverComponent } from '../popover/pb-popover.component';
import {
  Axis,
  createLayer,
  KIND_AXES,
  KIND_LABEL,
  LAYER_DEFAULTS,
  ORIGIN_DEFAULT,
  Origin,
  formatOrigin,
  parseOrigin,
  parseTransform,
  serializeTransform,
  summarizeLayer,
  TransformKind,
  TransformLayer,
} from './transform-model';

interface AxisConfig {
  axis: Axis;
  label: string;
  title: string;
}

@Component({
  selector: 'transform-control',
  templateUrl: './transform-control.component.html',
  styleUrls: ['./transform-control.component.scss'],
  standalone: true,
  imports: [CommonModule, CssUnitFieldComponent, OriginPadComponent, PbPopoverComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TransformControlComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransformControlComponent extends BaseControl {
  @Output() change = new EventEmitter<Partial<CSSStyleDeclaration>>();
  @ViewChild('pop') pop?: PbPopoverComponent;

  private readonly cd = inject(ChangeDetectorRef);
  private readonly cls = inject(ClassManagerService);

  protected readonly kinds: TransformKind[] = ['move', 'scale', 'rotate', 'skew'];
  protected readonly labels = KIND_LABEL;
  protected readonly lengthUnits = ['px', '%', 'em', 'rem', 'vw', 'vh'] as const;
  protected readonly angleUnits = ['deg'] as const;
  protected readonly originDefault = ORIGIN_DEFAULT;

  /** منبع حقیقت UI؛ با هر writeValue از روی style دوباره پارس می‌شود */
  protected readonly layers = signal<TransformLayer[]>([]);
  protected readonly selectedUid = signal<number | null>(null);
  protected readonly selected = computed(() => this.layers().find((l) => l.uid === this.selectedUid()) ?? null);
  /** قفل نسبت در Scale (X و Y هم‌زمان) */
  protected readonly scaleLinked = signal(true);

  protected readonly origin = signal<Origin>({ ...ORIGIN_DEFAULT });
  protected readonly originSet = signal(false);
  protected readonly perspective = signal('');
  protected readonly perspectiveOrigin = signal<Origin>({ ...ORIGIN_DEFAULT });
  protected readonly perspectiveOriginSet = signal(false);
  protected readonly backface = signal('');
  protected readonly transformStyle = signal('');

  /** CSS کامل برای پیش‌نمایش (با var() های حل‌شده، چون متغیرها در iframe تعریف شده‌اند نه در ادیتور) */
  protected readonly previewTransform = computed(() => this.resolve(serializeTransform(this.layers())));
  protected readonly previewPerspective = computed(() => this.resolve(this.perspective()));
  protected readonly previewOrigin = computed(() => this.resolve(formatOrigin(this.origin())));

  protected readonly hasAny = computed(
    () =>
      this.layers().length > 0 ||
      this.originSet() ||
      !!this.perspective() ||
      !!this.backface() ||
      !!this.transformStyle(),
  );

  private resolve(text: string): string {
    return resolveCssVars(text, this.cls.cssVariables);
  }

  //---------------------------------- ControlValueAccessor ----------------------------------

  writeValue(style: Partial<CSSStyleDeclaration>): void {
    this.style = style ?? {};
    const s = this.style;

    this.pop?.close();
    this.selectedUid.set(null);

    const layers = parseTransform(s.transform);
    this.layers.set(layers);
    this.hadTransform = layers.length > 0 || (s.transform ?? '').trim() === 'none';
    const sc = layers.find((l) => l.kind === 'scale');
    this.scaleLinked.set(!sc || sc.x === sc.y);

    const o = s.transformOrigin ? parseOrigin(s.transformOrigin) : null;
    this.origin.set(o ?? { ...ORIGIN_DEFAULT });
    this.originSet.set(!!s.transformOrigin);

    this.perspective.set(!s.perspective || s.perspective === 'none' ? '' : s.perspective);
    const po = s.perspectiveOrigin ? parseOrigin(s.perspectiveOrigin) : null;
    this.perspectiveOrigin.set(po ?? { ...ORIGIN_DEFAULT });
    this.perspectiveOriginSet.set(!!s.perspectiveOrigin);
    this.backface.set(s.backfaceVisibility ?? '');
    this.transformStyle.set(s.transformStyle ?? '');
    this.cd.markForCheck();
  }

  //---------------------------------- emit ----------------------------------

  /** مقدار فعلی signal ها را روی style می‌نویسد و بیرون می‌فرستد */
  private commit(): void {
    const s = this.style;
    const layers = this.layers();
    const css = serializeTransform(layers);
    // خالی شدن لیست = «none» صریح، وگرنه حذف آخرین لایه در breakpoint/state کوچک‌تر،
    // مقدار ارث‌بری‌شده را برنمی‌گرداند (override حذف می‌شد و transform بالادستی می‌ماند)
    s.transform = css || (this.hadTransform ? 'none' : '');
    if (css) this.hadTransform = true;

    s.transformOrigin = this.originSet() ? formatOrigin(this.origin()) : '';
    s.perspective = this.perspective();
    s.perspectiveOrigin = this.perspectiveOriginSet() && this.perspective() ? formatOrigin(this.perspectiveOrigin()) : '';
    s.backfaceVisibility = this.backface();
    s.transformStyle = this.transformStyle();

    this.onChange(s);
    this.change.emit(s);
    this.cd.markForCheck();
  }

  /** آیا در این context قبلاً transform ای وجود داشته (برای تصمیم none صریح) */
  private hadTransform = false;

  //---------------------------------- layers ----------------------------------

  protected add(kind: TransformKind, anchor?: HTMLElement): void {
    const layer = createLayer(kind);
    // Move/Scale/Rotate/Skew با مقدار پیش‌فرض بی‌اثرند؛ یک مقدار آغازین معنی‌دار می‌دهیم تا کاربر همان لحظه اثر را ببیند
    if (kind === 'move') layer.x = '20px';
    else if (kind === 'scale') layer.x = layer.y = '1.1';
    else if (kind === 'rotate') layer.z = '15deg';
    else if (kind === 'skew') layer.x = '10deg';
    this.layers.update((l) => [...l, layer]);
    this.hadTransform = true;
    this.scaleLinked.set(true);
    this.commit();
    this.selectedUid.set(layer.uid);
    // پس از رندر ردیف جدید، پاپ‌اوور را کنارش باز می‌کنیم
    queueMicrotask(() => {
      const row = this.rowEl(layer.uid) ?? anchor;
      if (row) this.pop?.open(row);
      this.cd.markForCheck();
    });
  }

  protected toggleLayer(uid: number, row: HTMLElement): void {
    if (this.selectedUid() === uid && this.pop?.isOpen()) {
      this.pop.close();
      return;
    }
    this.selectedUid.set(uid);
    const l = this.layers().find((x) => x.uid === uid);
    if (l?.kind === 'scale') this.scaleLinked.set(l.x === l.y);
    if (this.pop?.isOpen()) this.pop.moveTo(row);
    else this.pop?.open(row);
  }

  protected onPopupClosed(): void {
    this.selectedUid.set(null);
    this.cd.markForCheck();
  }

  protected remove(ev: Event, uid: number): void {
    ev.stopPropagation();
    if (this.selectedUid() === uid) this.pop?.close();
    this.layers.update((l) => l.filter((x) => x.uid !== uid));
    this.commit();
  }

  protected moveBy(ev: Event, uid: number, dir: -1 | 1): void {
    ev.stopPropagation();
    this.layers.update((list) => {
      const i = list.findIndex((x) => x.uid === uid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const copy = [...list];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
    this.commit();
  }

  protected setAxis(uid: number, axis: Axis, value: string): void {
    const link = this.scaleLinked();
    this.layers.update((list) =>
      list.map((l) => {
        if (l.uid !== uid) return l;
        const next: TransformLayer = { ...l, [axis]: value };
        if (l.kind === 'scale' && link && (axis === 'x' || axis === 'y')) {
          next.x = value;
          next.y = value;
        }
        return next;
      }),
    );
    this.commit();
  }

  protected setRaw(uid: number, raw: string): void {
    this.layers.update((list) => list.map((l) => (l.uid === uid ? { ...l, raw: raw.trim() } : l)));
    this.commit();
  }

  protected resetLayer(uid: number): void {
    this.layers.update((list) =>
      list.map((l) => (l.uid === uid && l.kind !== 'custom' ? { ...l, ...LAYER_DEFAULTS[l.kind] } : l)),
    );
    this.commit();
  }

  protected toggleScaleLink(): void {
    const next = !this.scaleLinked();
    this.scaleLinked.set(next);
    const l = this.selected();
    if (next && l && l.kind === 'scale') this.setAxis(l.uid, 'x', l.x);
  }

  protected axesOf(kind: TransformKind): AxisConfig[] {
    return KIND_AXES[kind].map((axis) => ({
      axis,
      label: axis.toUpperCase(),
      title: `${KIND_LABEL[kind]} ${axis.toUpperCase()}`,
    }));
  }

  protected summary(l: TransformLayer): string {
    return summarizeLayer(l);
  }

  protected trackLayer = (_: number, l: TransformLayer) => l.uid;

  private rowEl(uid: number): HTMLElement | null {
    return this.doc.querySelector<HTMLElement>(`transform-control [data-uid="${uid}"]`);
  }

  //---------------------------------- extras ----------------------------------

  protected setOrigin(v: OriginValue): void {
    this.origin.set({ ...this.origin(), x: v.x, y: v.y });
    this.originSet.set(true);
    this.commit();
  }

  protected clearOrigin(): void {
    this.originSet.set(false);
    this.origin.set({ ...ORIGIN_DEFAULT });
    this.commit();
  }

  protected setPerspective(v: string): void {
    this.perspective.set(!v || v === 'none' ? '' : v);
    this.commit();
  }

  protected setPerspectiveOrigin(v: OriginValue): void {
    this.perspectiveOrigin.set({ x: v.x, y: v.y });
    this.perspectiveOriginSet.set(true);
    this.commit();
  }

  protected setBackface(v: string): void {
    this.backface.set(this.backface() === v ? '' : v);
    this.commit();
  }

  protected setTransformStyle(v: string): void {
    this.transformStyle.set(this.transformStyle() === v ? '' : v);
    this.commit();
  }

  /** حذف همه‌ی override های transform در این context (برگشت به مقدار ارث‌بری‌شده) */
  protected clearAll(): void {
    this.pop?.close();
    this.layers.set([]);
    this.originSet.set(false);
    this.origin.set({ ...ORIGIN_DEFAULT });
    this.perspective.set('');
    this.perspectiveOriginSet.set(false);
    this.backface.set('');
    this.transformStyle.set('');
    this.hadTransform = false;
    this.commit();
  }
}
