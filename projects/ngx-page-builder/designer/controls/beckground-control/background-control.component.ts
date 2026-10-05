import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Output,
  computed,
  forwardRef,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import { FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Notify } from 'ngx-kit/notify';
import { IPageBuilderFilePicker } from '../../services/file-picker/IFilePicker';
import { NGX_PAGE_BUILDER_FILE_PICKER } from '../../services/file-picker/token.filepicker';
import { ClassManagerService } from '../../services/class-manager.service';
import { BaseControl } from '../base-control';
import { CssUnitFieldComponent } from '../css-unit-field/css-unit-field.component';
import { resolveCssVars } from '../css-unit-field/css-value-utils';
import { InputCssComponent } from '../input-css/input-css.component';
import { OriginPadComponent, OriginValue } from '../origin-pad/origin-pad.component';
import { PbPopoverComponent } from '../popover/pb-popover.component';
import { SegGroupComponent, SegOption } from '../seg-group/seg-group.component';
import { parseOrigin } from '../transform-control/transform-model';
import {
  BG_DEFAULTS,
  BgLayer,
  GRADIENT_PRESETS,
  buildImageUrl,
  gradientAngle,
  joinSize,
  layerMeta,
  layerTitle,
  newGradientLayer,
  newImageLayer,
  readBackground,
  serializeLayers,
  sizeMode,
  splitSize,
  unwrapUrl,
  withGradientAngle,
  wrapUrl,
} from './background-model';

const SIZE_MODES: SegOption[] = [
  { value: 'auto', label: 'Auto (original size)', text: 'Auto' },
  { value: 'cover', label: 'Cover (fill, may crop)', text: 'Cover' },
  { value: 'contain', label: 'Contain (fit inside)', text: 'Contain' },
  { value: 'custom', label: 'Custom width / height', text: 'Custom' },
];

const REPEAT: SegOption[] = [
  { value: 'no-repeat', label: 'No repeat', text: 'No repeat' },
  { value: 'repeat', label: 'Repeat', text: 'Repeat' },
  { value: 'repeat-x', label: 'Repeat horizontally', text: 'Repeat X' },
  { value: 'repeat-y', label: 'Repeat vertically', text: 'Repeat Y' },
  { value: 'space', label: 'Space (no cropping)', text: 'Space' },
  { value: 'round', label: 'Round (stretch to fit)', text: 'Round' },
];

const ATTACHMENT: SegOption[] = [
  { value: 'scroll', label: 'Scroll with the element', text: 'Scroll' },
  { value: 'fixed', label: 'Fixed to the viewport (parallax look)', text: 'Fixed' },
  { value: 'local', label: 'Scroll with the content', text: 'Local' },
];

const CLIP: SegOption[] = [
  { value: 'border-box', label: 'Border box', text: 'Border' },
  { value: 'padding-box', label: 'Padding box', text: 'Padding' },
  { value: 'content-box', label: 'Content box', text: 'Content' },
  { value: 'text', label: 'Clip to text (use with transparent text color)', text: 'Text' },
];

@Component({
  selector: 'background-control',
  templateUrl: './background-control.component.html',
  styleUrls: ['./background-control.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => BackgroundControlComponent),
      multi: true,
    },
  ],
  standalone: true,
  imports: [FormsModule, InputCssComponent, CssUnitFieldComponent, OriginPadComponent, PbPopoverComponent, SegGroupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackgroundControlComponent extends BaseControl {
  @Output() change = new EventEmitter<Partial<CSSStyleDeclaration>>();
  @ViewChild('pop') pop?: PbPopoverComponent;

  private readonly cd = inject(ChangeDetectorRef);
  private readonly cls = inject(ClassManagerService);
  private readonly filePicker = inject<IPageBuilderFilePicker | null>(NGX_PAGE_BUILDER_FILE_PICKER, { optional: true });

  protected readonly sizeModes = SIZE_MODES;
  protected readonly repeat = REPEAT;
  protected readonly attachment = ATTACHMENT;
  protected readonly clip = CLIP;
  protected readonly presets = GRADIENT_PRESETS;
  protected readonly defaults = BG_DEFAULTS;
  protected readonly lengthUnits = ['px', '%', 'em', 'rem', 'vw', 'vh'] as const;
  protected readonly hasFilePicker = !!this.filePicker;
  protected readonly title = layerTitle;
  protected readonly meta = layerMeta;

  /** منبع حقیقت UI: با هر writeValue از روی style پارس می‌شود و با ویرایش‌ها محلی نگه داشته می‌شود */
  protected readonly layers = signal<BgLayer[]>([]);
  protected readonly selectedUid = signal<number | null>(null);
  protected readonly selected = computed(() => this.layers().find((l) => l.uid === this.selectedUid()) ?? null);
  private readonly snap = signal<Partial<CSSStyleDeclaration>>({});
  protected readonly s = this.snap.asReadonly();
  protected readonly legacy = signal<{ has: boolean; unreadable: boolean }>({ has: false, unreadable: false });
  /** خطای ساده‌ی فایل‌پیکر/URL برای نمایش در پاپ‌اوور */
  protected readonly notice = signal('');

  /** آیا در این context قبلاً تصویر پس‌زمینه‌ای بوده (برای `none` صریح هنگام خالی شدن لیست) */
  private hadImages = false;
  /** رنگ استخراج‌شده از shorthand ی `background` قدیمی (تا اولین ویرایشِ لایه‌ها که به longhand منتقل می‌شود) */
  private legacyColor = '';

  private refreshSnap(): void {
    this.snap.set({
      ...this.style,
      backgroundColor: this.style.backgroundColor || (this.legacy().has ? this.legacyColor : ''),
    });
  }

  protected readonly clipValue = computed(() => this.s().backgroundClip ?? '');
  protected readonly clipsText = computed(() => this.clipValue() === 'text');
  protected readonly textColorTransparent = computed(() => {
    const c = (this.s().color ?? '').trim().toLowerCase();
    return c === 'transparent' || /^rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/.test(c);
  });

  protected readonly sizeModeValue = computed(() => (this.selected() ? sizeMode(this.selected()!.size) : 'auto'));
  /** W/H فقط در حالت custom معنی دارد؛ cover/contain/auto کلیدواژه‌اند و نباید به‌عنوان عرض بروند */
  protected readonly sizeParts = computed<[string, string]>(() =>
    this.sizeModeValue() === 'custom' ? splitSize(this.selected()?.size ?? '') : ['auto', 'auto'],
  );
  /** پیش‌فرض CSS برای background-position بالا-چپ است (نه وسط مثل transform-origin) */
  protected readonly position = computed(() => parseOrigin(this.selected()?.position) ?? { x: '0%', y: '0%' });
  protected readonly positionComplex = computed(() => {
    const p = this.selected()?.position?.trim();
    return !!p && parseOrigin(p) === null;
  });
  protected readonly angle = computed(() => {
    const l = this.selected();
    return l?.kind === 'gradient' ? gradientAngle(l.image) : null;
  });
  protected readonly imagePath = computed(() => {
    const l = this.selected();
    return l?.kind === 'image' ? (unwrapUrl(l.image) ?? l.image) : '';
  });

  /** پیش‌نمایش لایه‌ی انتخاب‌شده با خودِ CSS (واقعی، نه تقریب) */
  protected readonly previewCss = computed(() => {
    const l = this.selected();
    if (!l) return null;
    const vars = this.cls.cssVariables;
    return {
      image: resolveCssVars(l.image, vars) || 'none',
      size: l.size || 'auto',
      position: l.position || '0% 0%',
      repeat: l.repeat || 'repeat',
    };
  });

  //==================================================================================

  writeValue(style: Partial<CSSStyleDeclaration>): void {
    this.style = style ?? {};
    this.pop?.close();
    this.selectedUid.set(null);
    this.notice.set('');

    const st = readBackground(this.style);
    this.layers.set(st.layers);
    this.hadImages = st.layers.length > 0 || (this.style.backgroundImage ?? '').trim().toLowerCase() === 'none';
    this.legacy.set({ has: st.hasShorthand, unreadable: st.unreadable });
    this.legacyColor = st.color;
    this.refreshSnap();
    this.cd.markForCheck();
  }

  private applyRaw(patch: Record<string, string>): void {
    const st = this.style as unknown as Record<string, string>;
    for (const k of Object.keys(patch)) st[k] = patch[k];
    this.refreshSnap();
    this.onChange(this.style);
    this.change.emit(this.style);
    this.cd.markForCheck();
  }

  protected setProp(prop: string, value: string | undefined): void {
    this.applyRaw({ [prop]: value ?? '' });
  }

  /**
   * لایه‌ها را به longhand ها می‌نویسد. اگر `background` (shorthand) وجود داشته،
   * رنگ و بقیه‌ی اجزایش اول به longhand منتقل می‌شوند و shorthand پاک می‌شود، تا دو منبع حقیقت نداشته باشیم.
   */
  private commitLayers(): void {
    const w = serializeLayers(this.layers());
    const patch: Record<string, string> = { ...w };
    if (this.layers().length) this.hadImages = true;
    // خالی شدن لیست = `none` صریح تا تصویر ارث‌بری‌شده از base / breakpoint بزرگ‌تر لغو شود
    if (!w.backgroundImage && this.hadImages) patch['backgroundImage'] = 'none';
    if (this.legacy().has && !this.legacy().unreadable) {
      // رنگ را صریح به longhand می‌بریم (قبل از حذف shorthand) تا گم نشود
      patch['backgroundColor'] = this.s().backgroundColor ?? '';
      patch['background'] = '';
      this.legacy.set({ has: false, unreadable: false });
    }
    this.applyRaw(patch);
  }

  //---------------- layers ----------------

  protected addImage(anchor: HTMLElement): void {
    const layer = newImageLayer('');
    this.layers.update((l) => [layer, ...l]); // لایه‌ی جدید روی همه
    this.selectedUid.set(layer.uid);
    this.commitLayers();
    this.openFor(layer.uid, anchor);
    // بلافاصله انتخاب فایل را پیشنهاد می‌دهیم (اگر file picker هست)
    if (this.filePicker) queueMicrotask(() => this.chooseImage());
  }

  protected addGradient(anchor: HTMLElement, css = GRADIENT_PRESETS[3].css): void {
    const layer = newGradientLayer(css);
    this.layers.update((l) => [layer, ...l]);
    this.selectedUid.set(layer.uid);
    this.commitLayers();
    this.openFor(layer.uid, anchor);
  }

  private openFor(uid: number, anchor: HTMLElement): void {
    queueMicrotask(() => {
      const row = this.doc.querySelector<HTMLElement>(`background-control [data-uid="${uid}"]`) ?? anchor;
      this.pop?.open(row);
      this.cd.markForCheck();
    });
  }

  protected toggleLayer(uid: number, row: HTMLElement): void {
    if (this.selectedUid() === uid && this.pop?.isOpen()) {
      this.pop.close();
      return;
    }
    this.selectedUid.set(uid);
    this.notice.set('');
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
    this.commitLayers();
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
    this.commitLayers();
  }

  private patchLayer(uid: number, p: Partial<Omit<BgLayer, 'uid'>>): void {
    this.layers.update((list) => list.map((l) => (l.uid === uid ? { ...l, ...p } : l)));
    this.commitLayers();
  }

  //---------------- layer content ----------------

  protected setImageText(uid: number, ev: Event): void {
    const v = (ev.target as HTMLInputElement).value.trim();
    // آدرس ساده را خودمان در url("...") می‌گذاریم؛ مقدار کامل CSS (url(...) ، var() ، image-set()) دست‌نخورده می‌ماند
    const css = !v ? '' : /^[a-z-]+\(/i.test(v) ? v : wrapUrl(v);
    this.patchLayer(uid, { image: css });
    this.notice.set('');
  }

  protected setGradient(uid: number, value: string | undefined): void {
    const v = (value ?? '').trim();
    if (!v) return;
    this.patchLayer(uid, { image: v });
  }

  protected setGradientText(uid: number, ev: Event): void {
    this.setGradient(uid, (ev.target as HTMLTextAreaElement).value);
  }

  protected setAngle(uid: number, v: string): void {
    const l = this.layers().find((x) => x.uid === uid);
    const n = parseFloat(v);
    if (!l || !Number.isFinite(n)) return;
    this.patchLayer(uid, { image: withGradientAngle(l.image, ((n % 360) + 360) % 360) });
  }

  protected async chooseImage(): Promise<void> {
    const uid = this.selectedUid();
    if (uid === null) return;
    if (!this.filePicker) {
      Notify.warning('Provider for file picker is not available');
      this.notice.set('No file picker is configured. Paste an image URL instead.');
      return;
    }
    try {
      const result = await this.filePicker.openFilePicker('image');
      if (!result) return;
      this.patchLayer(uid, { image: buildImageUrl(result, this.filePicker.baseUrlAddress) });
      this.notice.set('');
    } catch {
      /* کاربر دیالوگ را بست */
    }
  }

  //---------------- tiling ----------------

  protected setSizeMode(uid: number, mode: string): void {
    if (mode === 'custom') {
      const [w, h] = this.sizeParts();
      this.patchLayer(uid, { size: joinSize(w === 'auto' ? '100%' : w, h) });
    } else this.patchLayer(uid, { size: mode === 'auto' ? '' : mode });
  }

  protected setSizeAxis(uid: number, axis: 0 | 1, v: string): void {
    const [w, h] = this.sizeParts();
    this.patchLayer(uid, { size: axis === 0 ? joinSize(v, h) : joinSize(w, v) });
  }

  protected setPosition(uid: number, v: OriginValue): void {
    this.patchLayer(uid, { position: `${v.x} ${v.y}` });
  }

  protected setPositionText(uid: number, ev: Event): void {
    this.patchLayer(uid, { position: (ev.target as HTMLInputElement).value.trim() });
  }

  protected setRepeat(uid: number, v: string): void {
    this.patchLayer(uid, { repeat: v });
  }

  protected setAttachment(uid: number, v: string): void {
    this.patchLayer(uid, { attachment: v });
  }

  protected resetTiling(uid: number): void {
    this.patchLayer(uid, { size: '', position: '', repeat: '', attachment: '' });
  }

  //---------------- color / clip ----------------

  protected setColor(v: string | undefined): void {
    this.setProp('backgroundColor', v);
  }

  protected setClip(v: string): void {
    this.setProp('backgroundClip', v);
  }

  protected makeTextTransparent(): void {
    this.setProp('color', 'transparent');
  }

  //---------------- legacy shorthand ----------------

  protected replaceShorthand(): void {
    this.layers.set([]);
    this.hadImages = false;
    this.legacy.set({ has: false, unreadable: false });
    this.applyRaw({ background: '', backgroundImage: '', backgroundSize: '', backgroundPosition: '', backgroundRepeat: '', backgroundAttachment: '' });
  }

  protected hasAny(): boolean {
    const s = this.s();
    return !!(
      this.layers().length || s.backgroundColor || s.background || s.backgroundImage || s.backgroundClip || this.hadImages
    );
  }

  protected clearAll(): void {
    this.pop?.close();
    this.layers.set([]);
    this.hadImages = false;
    this.legacy.set({ has: false, unreadable: false });
    this.applyRaw({
      background: '',
      backgroundColor: '',
      backgroundImage: '',
      backgroundSize: '',
      backgroundPosition: '',
      backgroundRepeat: '',
      backgroundAttachment: '',
      backgroundClip: '',
    });
  }

  protected resolved(css: string): string {
    return resolveCssVars(css, this.cls.cssVariables) || 'none';
  }

  protected trackLayer = (_: number, l: BgLayer) => l.uid;
}
