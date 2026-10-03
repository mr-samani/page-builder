import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import {
  Bezier,
  EASING_GROUPS,
  EASING_PRESETS,
  ParsedEasing,
  STEP_JUMPS,
  StepJump,
  easingSvgPath,
  findPreset,
  formatEasing,
  parseEasing,
} from './transition-model';

/** مختصات SVG: مربع ۰..۱ داخل کادر؛ y از -0.5 تا 1.5 دیده می‌شود تا overshoot (back) قابل ویرایش باشد */
const SIZE = 220;
const PAD = 30;
const Y_MIN = -0.5;
const Y_MAX = 1.5;

type Handle = 1 | 2;

/**
 * ویرایشگر easing: منحنی cubic-bezier با دو دستگیره‌ی قابل‌درگ، پریست‌ها، و حالت steps().
 * ورودی/خروجی رشته‌ی CSS است (`ease`، `cubic-bezier(...)`، `steps(...)`).
 */
@Component({
  selector: 'easing-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ee-tabs" role="tablist" aria-label="Easing type">
      <button type="button" role="tab" [class.on]="mode() !== 'steps'" [attr.aria-selected]="mode() !== 'steps'" (click)="toCurve()">
        Curve
      </button>
      <button type="button" role="tab" [class.on]="mode() === 'steps'" [attr.aria-selected]="mode() === 'steps'" (click)="toSteps()">
        Steps
      </button>
    </div>

    @if (parsed(); as e) {
      @if (e.kind === 'bezier') {
        <select class="ee-preset" aria-label="Easing preset" (change)="onPreset($event)">
          @if (!preset()) {
            <option value="" selected>Custom curve</option>
          }
          @for (g of groups; track g) {
            <optgroup [label]="g">
              @for (p of presetsOf(g); track p.id) {
                <option [value]="p.id" [selected]="preset()?.id === p.id">{{ p.label }}</option>
              }
            </optgroup>
          }
        </select>

        <svg
          class="ee-svg"
          [attr.viewBox]="'0 0 ' + size + ' ' + size"
          (pointermove)="onMove($event)"
          (pointerup)="onUp($event)"
          (pointercancel)="onUp($event)">
          <!-- frame + guides -->
          <rect [attr.x]="pad" [attr.y]="Y(1)" [attr.width]="size - 2 * pad" [attr.height]="Y(0) - Y(1)" class="ee-unit" />
          <line [attr.x1]="pad" [attr.x2]="size - pad" [attr.y1]="Y(0)" [attr.y2]="Y(0)" class="ee-axis" />
          <line [attr.x1]="pad" [attr.x2]="size - pad" [attr.y1]="Y(1)" [attr.y2]="Y(1)" class="ee-axis" />
          <line [attr.x1]="pad" [attr.x2]="pad" [attr.y1]="Y(Y_MAX)" [attr.y2]="Y(Y_MIN)" class="ee-axis faint" />
          <line [attr.x1]="size - pad" [attr.x2]="size - pad" [attr.y1]="Y(Y_MAX)" [attr.y2]="Y(Y_MIN)" class="ee-axis faint" />

          <!-- handle arms -->
          <line [attr.x1]="X(0)" [attr.y1]="Y(0)" [attr.x2]="X(e.p[0])" [attr.y2]="Y(e.p[1])" class="ee-arm" />
          <line [attr.x1]="X(1)" [attr.y1]="Y(1)" [attr.x2]="X(e.p[2])" [attr.y2]="Y(e.p[3])" class="ee-arm" />

          <!-- curve -->
          <path [attr.d]="curvePath()" class="ee-curve" />
          <circle [attr.cx]="X(0)" [attr.cy]="Y(0)" r="3.5" class="ee-end" />
          <circle [attr.cx]="X(1)" [attr.cy]="Y(1)" r="3.5" class="ee-end" />

          <!-- draggable handles -->
          <circle
            class="ee-handle"
            [class.drag]="dragging() === 1"
            [attr.cx]="X(e.p[0])"
            [attr.cy]="Y(e.p[1])"
            r="7"
            tabindex="0"
            role="slider"
            aria-label="Handle 1"
            [attr.aria-valuetext]="'x ' + e.p[0] + ', y ' + e.p[1]"
            (pointerdown)="onDown($event, 1)"
            (keydown)="onHandleKey($event, 1)" />
          <circle
            class="ee-handle"
            [class.drag]="dragging() === 2"
            [attr.cx]="X(e.p[2])"
            [attr.cy]="Y(e.p[3])"
            r="7"
            tabindex="0"
            role="slider"
            aria-label="Handle 2"
            [attr.aria-valuetext]="'x ' + e.p[2] + ', y ' + e.p[3]"
            (pointerdown)="onDown($event, 2)"
            (keydown)="onHandleKey($event, 2)" />
        </svg>

        <div class="ee-nums" aria-label="Control points">
          @for (i of idx; track i) {
            <input
              type="text"
              inputmode="decimal"
              class="ee-num"
              [attr.aria-label]="labels[i]"
              [title]="labels[i]"
              [value]="fmt(e.p[i])"
              (change)="onNum(i, $event)"
              (keydown.enter)="$any($event.target).blur()" />
          }
        </div>
      } @else if (e.kind === 'steps') {
        <div class="ee-steps">
          <label class="ee-lbl" for="eeSteps">Steps</label>
          <input
            id="eeSteps"
            type="number"
            min="1"
            max="60"
            step="1"
            class="ee-num wide"
            [value]="e.n"
            (input)="onStepsCount($event)" />
          <label class="ee-lbl" for="eeJump">Jump at</label>
          <select id="eeJump" class="ee-preset" (change)="onJump($event)">
            @for (j of jumps; track j.value) {
              <option [value]="j.value" [selected]="j.value === e.jump">{{ j.label }}</option>
            }
          </select>
        </div>
        <svg class="ee-svg short" [attr.viewBox]="'0 0 ' + size + ' ' + 130" aria-hidden="true">
          <path [attr.d]="stepsPath()" class="ee-curve" />
        </svg>
      } @else {
        <label class="ee-lbl" for="eeRaw">Custom easing</label>
        <input id="eeRaw" type="text" class="ee-raw" spellcheck="false" [value]="e.raw" (change)="onRaw($event)" />
        <p class="ee-note">Not editable visually. Kept exactly as written.</p>
      }
    }
  `,
  styles: `
    :host {
      display: block;
      color: #e8e8ea;
      font:
        12px/1.4 system-ui,
        -apple-system,
        'Segoe UI',
        sans-serif;
    }
    .ee-tabs {
      display: flex;
      background: #2a2a30;
      border-radius: 5px;
      padding: 2px;
      gap: 2px;
      margin-bottom: 8px;
    }
    .ee-tabs button {
      all: unset;
      box-sizing: border-box;
      flex: 1;
      text-align: center;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      color: #a8a8b2;
      cursor: pointer;
    }
    .ee-tabs button:hover {
      color: #fff;
    }
    .ee-tabs button.on {
      background: #4b8bff;
      color: #fff;
    }
    .ee-tabs button:focus-visible {
      outline: 2px solid #fff;
      outline-offset: -2px;
    }
    .ee-preset {
      all: unset;
      box-sizing: border-box;
      display: block;
      width: 100%;
      height: 26px;
      padding: 0 6px;
      border-radius: 4px;
      background: #2a2a30;
      color: #fff;
      font-size: 12px;
      cursor: pointer;
      appearance: auto;
    }
    .ee-preset:focus-visible {
      outline: 2px solid #4b8bff;
    }
    .ee-svg {
      display: block;
      width: 100%;
      aspect-ratio: 1;
      margin-top: 8px;
      background: #121214;
      border: 1px solid #34343a;
      border-radius: 6px;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }
    .ee-svg.short {
      aspect-ratio: 220 / 130;
    }
    .ee-unit {
      fill: #ffffff08;
      stroke: #3c3c44;
      stroke-width: 1;
    }
    .ee-axis {
      stroke: #46464f;
      stroke-width: 1;
      stroke-dasharray: 3 3;
    }
    .ee-axis.faint {
      stroke: #2b2b31;
    }
    .ee-arm {
      stroke: #7a7a86;
      stroke-width: 1.5;
    }
    .ee-curve {
      fill: none;
      stroke: #4b8bff;
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .ee-end {
      fill: #e8e8ea;
    }
    .ee-handle {
      fill: #7c5cff;
      stroke: #fff;
      stroke-width: 2;
      cursor: grab;
      transition: r 0.1s;
    }
    .ee-handle:hover,
    .ee-handle.drag {
      r: 9;
    }
    .ee-handle.drag {
      cursor: grabbing;
    }
    .ee-handle:focus-visible {
      outline: none;
      stroke: #ffd54a;
      stroke-width: 3;
    }
    .ee-nums {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 4px;
      margin-top: 8px;
    }
    .ee-num,
    .ee-raw {
      all: unset;
      box-sizing: border-box;
      height: 26px;
      padding: 0 6px;
      border-radius: 4px;
      background: #2a2a30;
      color: #fff;
      font:
        11px/1 ui-monospace,
        Menlo,
        Consolas,
        monospace;
      text-align: center;
      min-width: 0;
    }
    .ee-raw {
      display: block;
      width: 100%;
      text-align: left;
      margin-top: 4px;
    }
    .ee-num.wide {
      width: 100%;
    }
    .ee-num:focus,
    .ee-raw:focus {
      outline: 1px solid #4b8bff;
    }
    .ee-steps {
      display: grid;
      grid-template-columns: 56px 1fr;
      gap: 6px 8px;
      align-items: center;
    }
    .ee-lbl {
      font-size: 11px;
      color: #a8a8b2;
    }
    .ee-note {
      margin: 6px 0 0;
      font-size: 10.5px;
      color: #7c7c88;
    }
  `,
})
export class EasingEditorComponent {
  /** مقدار CSS (دوطرفه) */
  value = input<string>('ease');
  changed = output<string>();

  protected readonly size = SIZE;
  protected readonly pad = PAD;
  protected readonly Y_MIN = Y_MIN;
  protected readonly Y_MAX = Y_MAX;
  protected readonly idx = [0, 1, 2, 3] as const;
  protected readonly labels = ['Point 1 X', 'Point 1 Y', 'Point 2 X', 'Point 2 Y'];
  protected readonly groups = EASING_GROUPS;
  protected readonly jumps = STEP_JUMPS;
  protected readonly dragging = signal<Handle | 0>(0);

  /** هنگام درگ، مقدار محلی را نگه می‌داریم تا منحنی روان باشد و منتظر رفت‌وبرگشت با والد نمانیم */
  private readonly local = signal<string | null>(null);

  protected readonly parsed = computed<ParsedEasing>(() => parseEasing(this.local() ?? this.value()));
  protected readonly mode = computed(() => this.parsed().kind);
  protected readonly preset = computed(() => {
    const e = this.parsed();
    return e.kind === 'bezier' ? findPreset(e.p) : undefined;
  });
  protected readonly curvePath = computed(() => {
    const e = this.parsed();
    if (e.kind !== 'bezier') return '';
    const [a, b, c, d] = e.p;
    return `M${this.X(0)},${this.Y(0)} C${this.X(a)},${this.Y(b)} ${this.X(c)},${this.Y(d)} ${this.X(1)},${this.Y(1)}`;
  });
  protected readonly stepsPath = computed(() => {
    const e = this.parsed();
    return e.kind === 'steps' ? easingSvgPath(e, SIZE, 130, PAD) : '';
  });

  protected X = (v: number) => +(PAD + v * (SIZE - 2 * PAD)).toFixed(2);
  protected Y = (v: number) => {
    const top = PAD;
    const bottom = SIZE - PAD;
    // 0 → پایین‌ِ مربع واحد، 1 → بالای آن؛ مقادیر خارج از بازه ادامه می‌یابند
    return +(bottom - v * (bottom - top)).toFixed(2);
  };

  protected presetsOf(group: string) {
    return EASING_PRESETS.filter((p) => p.group === group);
  }

  protected fmt(n: number): string {
    return String(Math.round(n * 1000) / 1000);
  }

  //---------------------------------- emit ----------------------------------

  private emit(e: ParsedEasing, final = true): void {
    const css = formatEasing(e);
    this.local.set(final ? null : css);
    this.changed.emit(css);
  }

  private currentBezier(): Bezier {
    const e = this.parsed();
    return e.kind === 'bezier' ? [...e.p] as Bezier : [0.25, 0.1, 0.25, 1];
  }

  //---------------------------------- mode / presets ----------------------------------

  protected toCurve(): void {
    if (this.mode() !== 'steps') return;
    this.emit({ kind: 'bezier', p: [0.25, 0.1, 0.25, 1] });
  }

  protected toSteps(): void {
    if (this.mode() === 'steps') return;
    this.emit({ kind: 'steps', n: 4, jump: 'end' });
  }

  protected onPreset(ev: Event): void {
    const p = EASING_PRESETS.find((x) => x.id === (ev.target as HTMLSelectElement).value);
    if (p) this.emit({ kind: 'bezier', p: [...p.p] as Bezier });
  }

  //---------------------------------- drag ----------------------------------

  private svgEl?: SVGSVGElement;

  protected onDown(ev: PointerEvent, h: Handle): void {
    if (ev.button !== 0) return;
    ev.preventDefault();
    this.svgEl = (ev.target as SVGElement).ownerSVGElement ?? undefined;
    (ev.target as Element).setPointerCapture(ev.pointerId);
    this.dragging.set(h);
  }

  protected onMove(ev: PointerEvent): void {
    const h = this.dragging();
    if (!h || !this.svgEl) return;
    const r = this.svgEl.getBoundingClientRect();
    if (!r.width) return;
    // پیکسل صفحه → مختصات viewBox → مقدار 0..1
    const vx = ((ev.clientX - r.left) / r.width) * SIZE;
    const vy = ((ev.clientY - r.top) / r.height) * SIZE;
    const snap = ev.shiftKey ? 0.05 : 0.01;
    const round = (n: number) => Math.round(n / snap) * snap;

    let x = round((vx - PAD) / (SIZE - 2 * PAD));
    let y = round((SIZE - PAD - vy) / (SIZE - 2 * PAD));
    x = Math.min(1, Math.max(0, x));
    y = Math.min(Y_MAX, Math.max(Y_MIN, y));

    const p = this.currentBezier();
    if (h === 1) [p[0], p[1]] = [x, y];
    else [p[2], p[3]] = [x, y];
    this.emit({ kind: 'bezier', p: p.map((n) => Math.round(n * 1000) / 1000) as Bezier }, false);
  }

  protected onUp(ev: PointerEvent): void {
    if (!this.dragging()) return;
    this.dragging.set(0);
    this.svgEl = undefined;
    const t = ev.target as Element;
    if (t.hasPointerCapture?.(ev.pointerId)) t.releasePointerCapture(ev.pointerId);
    this.local.set(null);
  }

  protected onHandleKey(ev: KeyboardEvent, h: Handle): void {
    const d: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, 1],
      ArrowDown: [0, -1],
    };
    const dir = d[ev.key];
    if (!dir) return;
    ev.preventDefault();
    const step = ev.shiftKey ? 0.1 : 0.01;
    const p = this.currentBezier();
    const ix = h === 1 ? 0 : 2;
    p[ix] = Math.min(1, Math.max(0, p[ix] + dir[0] * step));
    p[ix + 1] = Math.min(Y_MAX, Math.max(Y_MIN, p[ix + 1] + dir[1] * step));
    this.emit({ kind: 'bezier', p: p.map((n) => Math.round(n * 1000) / 1000) as Bezier });
  }

  //---------------------------------- numeric fields ----------------------------------

  protected onNum(i: number, ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const n = Number(input.value.trim());
    const p = this.currentBezier();
    if (!Number.isFinite(n)) {
      input.value = this.fmt(p[i]);
      return;
    }
    p[i] = i % 2 === 0 ? Math.min(1, Math.max(0, n)) : Math.min(Y_MAX * 2, Math.max(Y_MIN * 2, n));
    input.value = this.fmt(p[i]);
    this.emit({ kind: 'bezier', p });
  }

  //---------------------------------- steps / raw ----------------------------------

  protected onStepsCount(ev: Event): void {
    const n = Math.round(Number((ev.target as HTMLInputElement).value));
    const e = this.parsed();
    if (e.kind !== 'steps' || !Number.isFinite(n) || n < 1) return;
    this.emit({ ...e, n: Math.min(60, n) });
  }

  protected onJump(ev: Event): void {
    const e = this.parsed();
    if (e.kind === 'steps') this.emit({ ...e, jump: (ev.target as HTMLSelectElement).value as StepJump });
  }

  protected onRaw(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value.trim();
    if (v) this.changed.emit(v);
  }
}
