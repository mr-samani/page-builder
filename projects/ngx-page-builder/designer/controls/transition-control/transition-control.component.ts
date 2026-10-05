import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  Output,
  ViewChild,
  computed,
  forwardRef,
  signal,
} from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { BaseControl } from '../base-control';
import { CssUnitFieldComponent } from '../css-unit-field/css-unit-field.component';
import { PbPopoverComponent } from '../popover/pb-popover.component';
import { EasingEditorComponent } from './easing-editor.component';
import {
  ALL_KNOWN_PROPERTIES,
  TRANSITION_PROPERTY_GROUPS,
  TransitionLayer,
  createTransition,
  describeEasing,
  easingSvgPath,
  isValidPropertyName,
  parseEasing,
  parseTransitionStyle,
  serializeTransition,
} from './transition-model';

const CUSTOM_KEY = '__custom__';

interface RowView {
  layer: TransitionLayer;
  title: string;
  meta: string;
  path: string;
}

/** «200ms» / «0.2s» → میلی‌ثانیه (برای پیش‌نمایش) */
function toMs(text: string): number {
  const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+))(ms|s)\s*$/i.exec(text);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  return m[2].toLowerCase() === 's' ? n * 1000 : n;
}

@Component({
  selector: 'transition-control',
  templateUrl: './transition-control.component.html',
  styleUrls: ['./transition-control.component.scss'],
  standalone: true,
  imports: [CommonModule, CssUnitFieldComponent, PbPopoverComponent, EasingEditorComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TransitionControlComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransitionControlComponent extends BaseControl implements OnDestroy {
  @Output() change = new EventEmitter<Partial<CSSStyleDeclaration>>();
  @ViewChild('pop') pop?: PbPopoverComponent;
  @ViewChild('dot') dot?: ElementRef<HTMLElement>;
  @ViewChild('track') track?: ElementRef<HTMLElement>;

  constructor(private cd: ChangeDetectorRef) {
    super();
  }

  protected readonly groups = TRANSITION_PROPERTY_GROUPS;
  protected readonly customKey = CUSTOM_KEY;
  protected readonly timeUnits = ['ms', 's'] as const;
  protected readonly timeStep = { ms: 10, s: 0.05 };
  protected readonly timeFactors = { ms: 1, s: 1000 };

  protected readonly layers = signal<TransitionLayer[]>([]);
  protected readonly selectedUid = signal<number | null>(null);
  protected readonly selected = computed(() => this.layers().find((l) => l.uid === this.selectedUid()) ?? null);
  /** کاربر «Custom…» را زده ولی هنوز نام ننوشته */
  private readonly customMode = signal(false);

  protected readonly rows = computed<RowView[]>(() =>
    this.layers().map((layer) => {
      if (layer.raw) return { layer, title: 'Custom', meta: layer.raw, path: easingSvgPath(parseEasing(''), 30, 20) };
      const delay = layer.delay && toMs(layer.delay) !== 0 ? ` · +${layer.delay}` : '';
      return {
        layer,
        title: layer.property === 'all' ? 'All properties' : layer.property,
        meta: `${layer.duration}${delay} · ${describeEasing(layer.easing)}`,
        path: easingSvgPath(parseEasing(layer.easing), 30, 20, 3),
      };
    }),
  );

  protected readonly propKey = computed(() => {
    const l = this.selected();
    if (!l) return '';
    return this.customMode() || !ALL_KNOWN_PROPERTIES.has(l.property) ? CUSTOM_KEY : l.property;
  });

  /** آیا در این context قبلاً transition ای وجود داشته (برای none صریح هنگام خالی شدن) */
  private hadTransition = false;

  //---------------------------------- ControlValueAccessor ----------------------------------

  writeValue(style: Partial<CSSStyleDeclaration>): void {
    this.style = style ?? {};
    this.pop?.close();
    this.selectedUid.set(null);
    this.customMode.set(false);

    const layers = parseTransitionStyle(this.style);
    this.layers.set(layers);
    this.hadTransition =
      layers.length > 0 || (this.style.transition ?? '').trim() === 'none' || (this.style.transitionProperty ?? '').trim() === 'none';
    this.cd.markForCheck();
  }

  //---------------------------------- emit ----------------------------------

  private commit(): void {
    const s = this.style;
    const css = serializeTransition(this.layers());
    if (css) this.hadTransition = true;
    // خالی شدن لیست = «none» صریح تا transition ارث‌بری‌شده از base / breakpoint بزرگ‌تر لغو شود
    s.transition = css || (this.hadTransition ? 'none' : '');
    // اگر از قبل longhand بوده، با نوشتن shorthand منسوخ می‌شوند؛ پاکشان می‌کنیم تا دو منبع حقیقت نداشته باشیم
    s.transitionProperty = '';
    s.transitionDuration = '';
    s.transitionTimingFunction = '';
    s.transitionDelay = '';

    this.onChange(s);
    this.change.emit(s);
    this.cd.markForCheck();
  }

  //---------------------------------- layers ----------------------------------

  protected add(addRow: HTMLElement): void {
    // اولین transition همان «all» است؛ بعدی‌ها پیشنهاد opacity/transform تا تکراری ساخته نشود
    const used = new Set(this.layers().map((l) => l.property));
    const property = !used.has('all') && this.layers().length === 0 ? 'all' : ['opacity', 'transform', 'color'].find((p) => !used.has(p)) ?? 'all';
    const layer = createTransition({ property });
    this.layers.update((l) => [...l, layer]);
    this.hadTransition = true;
    this.commit();
    this.selectedUid.set(layer.uid);
    queueMicrotask(() => {
      const row = this.doc.querySelector<HTMLElement>(`transition-control [data-uid="${layer.uid}"]`) ?? addRow;
      this.pop?.open(row);
      this.scheduleReplay(120);
      this.cd.markForCheck();
    });
  }

  protected toggleLayer(uid: number, row: HTMLElement): void {
    if (this.selectedUid() === uid && this.pop?.isOpen()) {
      this.pop.close();
      return;
    }
    this.selectedUid.set(uid);
    this.customMode.set(false);
    if (this.pop?.isOpen()) this.pop.moveTo(row);
    else this.pop?.open(row);
    this.scheduleReplay(150);
  }

  protected onPopupClosed(): void {
    this.selectedUid.set(null);
    this.stopPreview();
    this.cd.markForCheck();
  }

  protected remove(ev: Event, uid: number): void {
    ev.stopPropagation();
    if (this.selectedUid() === uid) this.pop?.close();
    this.layers.update((l) => l.filter((x) => x.uid !== uid));
    this.commit();
  }

  protected duplicate(ev: Event, uid: number): void {
    ev.stopPropagation();
    const src = this.layers().find((x) => x.uid === uid);
    if (!src) return;
    const copy = createTransition({ ...src });
    this.layers.update((l) => {
      const i = l.findIndex((x) => x.uid === uid);
      const n = [...l];
      n.splice(i + 1, 0, copy);
      return n;
    });
    this.commit();
  }

  private patch(uid: number, p: Partial<Omit<TransitionLayer, 'uid'>>): void {
    this.layers.update((list) => list.map((l) => (l.uid === uid ? { ...l, ...p, raw: '' } : l)));
    this.commit();
    this.scheduleReplay();
  }

  protected onProperty(uid: number, ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value;
    if (v === CUSTOM_KEY) {
      this.customMode.set(true);
      this.cd.markForCheck();
      return;
    }
    this.customMode.set(false);
    this.patch(uid, { property: v });
  }

  protected onCustomProperty(uid: number, ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const v = input.value.trim().toLowerCase();
    if (!isValidPropertyName(v)) {
      input.classList.add('invalid');
      return;
    }
    input.classList.remove('invalid');
    this.patch(uid, { property: v });
  }

  protected setDuration(uid: number, v: string): void {
    this.patch(uid, { duration: v });
  }
  protected setDelay(uid: number, v: string): void {
    this.patch(uid, { delay: v });
  }
  protected setEasing(uid: number, v: string): void {
    this.patch(uid, { easing: v });
  }

  protected clearAll(): void {
    this.pop?.close();
    this.layers.set([]);
    this.hadTransition = false;
    this.commit();
  }

  protected trackRow = (_: number, r: RowView) => r.layer.uid;

  //---------------------------------- live preview ----------------------------------

  private replayTimer?: ReturnType<typeof setTimeout>;
  private anim?: Animation;

  /** پس از توقف ویرایش (debounce) انیمیشن را با همین مقدارها دوباره پخش می‌کند */
  protected scheduleReplay(delay = 260): void {
    clearTimeout(this.replayTimer);
    this.replayTimer = setTimeout(() => this.replay(), delay);
  }

  protected replay(): void {
    const l = this.selected();
    const dot = this.dot?.nativeElement;
    const track = this.track?.nativeElement;
    if (!l || !dot || !track || typeof dot.animate !== 'function') return;
    this.anim?.cancel();

    const travel = Math.max(0, track.clientWidth - dot.offsetWidth - 4);
    const duration = Math.max(1, toMs(l.duration));
    const delay = Math.max(0, toMs(l.delay));
    try {
      this.anim = dot.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${travel}px)` }], {
        duration,
        delay,
        easing: l.easing || 'ease',
        fill: 'both',
      });
    } catch {
      // easing نامعتبر (مثلاً linear() قدیمی) — پیش‌نمایش بی‌اهمیت‌تر از خراب‌شدن UI است
      this.anim = undefined;
    }
  }

  private stopPreview(): void {
    clearTimeout(this.replayTimer);
    this.anim?.cancel();
    this.anim = undefined;
  }

  ngOnDestroy(): void {
    this.stopPreview();
  }
}
