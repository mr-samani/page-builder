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
import { ANIMATION_PRESETS, ANIMATION_PRESET_GROUPS, AnimationPreset, findAnimationPreset, framesToKeyframeObjects } from 'ngx-page-builder/core';
import { BaseControl } from '../base-control';
import { CssUnitFieldComponent } from '../css-unit-field/css-unit-field.component';
import { PbPopoverComponent } from '../popover/pb-popover.component';
import { SegOption, SegGroupComponent } from '../seg-group/seg-group.component';
import { EasingEditorComponent } from '../transition-control/easing-editor.component';
import { describeEasing, easingSvgPath, parseEasing } from '../transition-control/transition-model';
import {
  AnimationLayer,
  applyPresetDefaults,
  createAnimation,
  isValidAnimationName,
  parseAnimationStyle,
  serializeAnimation,
} from './animation-model';

const CUSTOM_KEY = '__custom__';

interface RowView {
  layer: AnimationLayer;
  title: string;
  meta: string;
  path: string;
}

interface PresetGroupView {
  label: string;
  items: AnimationPreset[];
}

/** «200ms» / «0.2s» → میلی‌ثانیه (برای پیش‌نمایش) */
function toMs(text: string): number {
  const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+))(ms|s)\s*$/i.exec(text);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  return m[2].toLowerCase() === 's' ? n * 1000 : n;
}

@Component({
  selector: 'animation-control',
  templateUrl: './animation-control.component.html',
  styleUrls: ['./animation-control.component.scss'],
  standalone: true,
  imports: [CommonModule, CssUnitFieldComponent, PbPopoverComponent, EasingEditorComponent, SegGroupComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AnimationControlComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnimationControlComponent extends BaseControl implements OnDestroy {
  @Output() change = new EventEmitter<Partial<CSSStyleDeclaration>>();
  @ViewChild('pop') pop?: PbPopoverComponent;
  @ViewChild('box') box?: ElementRef<HTMLElement>;

  constructor(private cd: ChangeDetectorRef) {
    super();
  }

  protected readonly customKey = CUSTOM_KEY;
  protected readonly timeUnits = ['ms', 's'] as const;
  protected readonly timeStep = { ms: 10, s: 0.05 };
  protected readonly timeFactors = { ms: 1, s: 1000 };

  protected readonly groups: PresetGroupView[] = ANIMATION_PRESET_GROUPS.map((label) => ({
    label,
    items: ANIMATION_PRESETS.filter((p) => p.group === label) as AnimationPreset[],
  }));

  protected readonly iterationOptions: SegOption[] = [
    { value: '1', label: 'Once', text: '1' },
    { value: '2', label: 'Twice', text: '2' },
    { value: '3', label: '3 times', text: '3' },
    { value: 'infinite', label: 'Infinite loop', text: '∞' },
  ];
  protected readonly directionOptions: SegOption[] = [
    { value: 'normal', label: 'Normal', title: 'Forwards each time', text: 'Normal' },
    { value: 'reverse', label: 'Reverse', title: 'Backwards each time', text: 'Reverse' },
    { value: 'alternate', label: 'Alternate', title: 'Forwards, then backwards', text: 'Alt' },
    { value: 'alternate-reverse', label: 'Alternate reverse', title: 'Backwards, then forwards', text: 'Alt rev' },
  ];
  protected readonly fillOptions: SegOption[] = [
    { value: 'none', label: 'None', title: 'Element returns to its own style when done', text: 'None' },
    { value: 'forwards', label: 'Forwards', title: 'Keep the last frame after it ends', text: 'After' },
    { value: 'backwards', label: 'Backwards', title: 'Apply the first frame during the delay', text: 'Before' },
    { value: 'both', label: 'Both', title: 'Apply the first frame during the delay and keep the last one', text: 'Both' },
  ];
  protected readonly playOptions: SegOption[] = [
    { value: 'running', label: 'Running', text: 'Running' },
    { value: 'paused', label: 'Paused', title: 'Freeze the animation (useful while styling)', text: 'Paused' },
  ];

  protected readonly layers = signal<AnimationLayer[]>([]);
  protected readonly selectedUid = signal<number | null>(null);
  protected readonly selected = computed(() => this.layers().find((l) => l.uid === this.selectedUid()) ?? null);
  /** کاربر «Custom…» را زده ولی هنوز نام ننوشته */
  private readonly customMode = signal(false);

  protected readonly rows = computed<RowView[]>(() =>
    this.layers().map((layer) => {
      if (layer.raw) return { layer, title: 'Custom', meta: layer.raw, path: easingSvgPath(parseEasing(''), 30, 20) };
      const preset = findAnimationPreset(layer.name);
      const delay = layer.delay && toMs(layer.delay) !== 0 ? ` · +${layer.delay}` : '';
      const loops = layer.iterations === 'infinite' ? ' · ∞' : layer.iterations !== '1' ? ` · ×${layer.iterations}` : '';
      return {
        layer,
        title: preset?.label ?? layer.name,
        meta: `${layer.duration}${delay}${loops} · ${describeEasing(layer.easing)}`,
        path: easingSvgPath(parseEasing(layer.easing), 30, 20, 3),
      };
    }),
  );

  /** مقدار select نام: id پریست یا Custom */
  protected readonly nameKey = computed(() => {
    const l = this.selected();
    if (!l) return '';
    const p = findAnimationPreset(l.name);
    return this.customMode() || !p ? CUSTOM_KEY : p.name;
  });

  /** پیش‌نمایش فقط برای پریست‌های داخلی ممکن است (keyframes ی کاربر در iframe ی کَنوَس است) */
  protected readonly canPreview = computed(() => !!findAnimationPreset(this.selected()?.name));

  /** آیا در این context قبلاً animation ای وجود داشته (برای none صریح هنگام خالی شدن) */
  private hadAnimation = false;

  //---------------------------------- ControlValueAccessor ----------------------------------

  writeValue(style: Partial<CSSStyleDeclaration>): void {
    this.style = style ?? {};
    this.pop?.close();
    this.selectedUid.set(null);
    this.customMode.set(false);

    const layers = parseAnimationStyle(this.style);
    this.layers.set(layers);
    this.hadAnimation = layers.length > 0 || (this.style.animation ?? '').trim() === 'none' || (this.style.animationName ?? '').trim() === 'none';
    this.cd.markForCheck();
  }

  //---------------------------------- emit ----------------------------------

  private commit(): void {
    const s = this.style;
    const css = serializeAnimation(this.layers());
    if (css) this.hadAnimation = true;
    // خالی شدن لیست = «none» صریح تا animation ارث‌بری‌شده از base / breakpoint بزرگ‌تر لغو شود
    s.animation = css || (this.hadAnimation ? 'none' : '');
    // اگر از قبل longhand بوده، با نوشتن shorthand منسوخ می‌شوند؛ پاکشان می‌کنیم تا دو منبع حقیقت نداشته باشیم
    s.animationName = '';
    s.animationDuration = '';
    s.animationTimingFunction = '';
    s.animationDelay = '';
    s.animationIterationCount = '';
    s.animationDirection = '';
    s.animationFillMode = '';
    s.animationPlayState = '';

    this.onChange(s);
    this.change.emit(s);
    this.cd.markForCheck();
  }

  //---------------------------------- layers ----------------------------------

  protected add(addRow: HTMLElement): void {
    const first = ANIMATION_PRESETS[0];
    const layer = createAnimation({ name: first.name, ...applyPresetDefaults(first.defaults) });
    this.layers.update((l) => [...l, layer]);
    this.hadAnimation = true;
    this.commit();
    this.selectedUid.set(layer.uid);
    queueMicrotask(() => {
      const row = this.doc.querySelector<HTMLElement>(`animation-control [data-uid="${layer.uid}"]`) ?? addRow;
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
    const copy = createAnimation({ ...src });
    this.layers.update((l) => {
      const i = l.findIndex((x) => x.uid === uid);
      const n = [...l];
      n.splice(i + 1, 0, copy);
      return n;
    });
    this.commit();
  }

  private patch(uid: number, p: Partial<Omit<AnimationLayer, 'uid'>>): void {
    this.layers.update((list) => list.map((l) => (l.uid === uid ? { ...l, ...p, raw: '' } : l)));
    this.commit();
    this.scheduleReplay();
  }

  protected onName(uid: number, ev: Event): void {
    const v = (ev.target as HTMLSelectElement).value;
    if (v === CUSTOM_KEY) {
      this.customMode.set(true);
      this.cd.markForCheck();
      return;
    }
    this.customMode.set(false);
    const preset = findAnimationPreset(v);
    this.patch(uid, { name: v, ...applyPresetDefaults(preset?.defaults) });
  }

  protected onCustomName(uid: number, ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const v = input.value.trim();
    if (!isValidAnimationName(v)) {
      input.classList.add('invalid');
      return;
    }
    input.classList.remove('invalid');
    this.patch(uid, { name: v });
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
  protected setIterations(uid: number, v: string): void {
    this.patch(uid, { iterations: v || '1' });
  }
  protected onCount(uid: number, ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const n = parseFloat(input.value);
    if (!Number.isFinite(n) || n < 0) {
      input.classList.add('invalid');
      return;
    }
    input.classList.remove('invalid');
    this.patch(uid, { iterations: String(n) });
  }
  protected setDirection(uid: number, v: string): void {
    this.patch(uid, { direction: v || 'normal' });
  }
  protected setFill(uid: number, v: string): void {
    this.patch(uid, { fill: v || 'none' });
  }
  protected setPlayState(uid: number, v: string): void {
    this.patch(uid, { playState: v || 'running' });
  }

  protected countValue(l: AnimationLayer): string {
    return l.iterations === 'infinite' ? '' : l.iterations;
  }

  protected clearAll(): void {
    this.pop?.close();
    this.layers.set([]);
    this.hadAnimation = false;
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
    const el = this.box?.nativeElement;
    const preset = findAnimationPreset(l?.name);
    if (!l || !el || !preset || typeof el.animate !== 'function') return;
    this.anim?.cancel();

    try {
      this.anim = el.animate(framesToKeyframeObjects(preset, l.easing || 'ease'), {
        duration: Math.max(1, toMs(l.duration)),
        delay: Math.max(0, toMs(l.delay)),
        iterations: l.iterations === 'infinite' ? Infinity : Math.max(0, parseFloat(l.iterations) || 1),
        direction: l.direction as PlaybackDirection,
        fill: l.fill as FillMode,
      });
      if (l.playState === 'paused') this.anim.pause();
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
