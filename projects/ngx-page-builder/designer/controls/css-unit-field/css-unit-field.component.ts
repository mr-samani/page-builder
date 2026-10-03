import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import type { CssValueType } from 'ngx-page-builder/core';
import { CssVarPickerComponent } from '../css-var-picker/css-var-picker.component';
import { parseCssNumber, trimNum } from './css-value-utils';

/**
 * فیلد عددی + واحد برای مقدارهای CSS، با تجربه‌ی مشابه Webflow:
 *  - برچسب را بکشید (drag) تا مقدار تغییر کند؛ Shift ×۱۰ ، Alt ×۰٫۱
 *  - ↑ / ↓ داخل فیلد (با Shift/Alt مثل بالا)
 *  - دکمه‌ی ƒ: مقدار سفارشی (var(--x)، calc()، clamp()، ...) به‌صورت متن آزاد
 *  - دکمه‌ی 📐: انتخاب از متغیرهای CSS (اگر `enableCssVariable` فعال باشد)
 *  - اسلایدر اختیاری
 *
 * مقدار همیشه یک «رشته‌ی CSS» است (مثل `20px`، `1.2`، `45deg`، `var(--gap)`).
 *
 * @example
 * <css-unit-field label="X" [units]="['px','%']" fallback="0px" [(value)]="x" />
 */
@Component({
  selector: 'css-unit-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CssVarPickerComponent],
  template: `
    <div class="cuf" [class.custom]="isCustom()">
      @if (label()) {
        <span
          class="cuf-label"
          [class.scrub]="!isCustom()"
          [style.width.px]="labelWidth()"
          [title]="title() || (isCustom() ? label() : 'Drag to change · Shift ×10 · Alt ×0.1')"
          (pointerdown)="scrubStart($event)"
          (pointermove)="scrubMove($event)"
          (pointerup)="scrubEnd($event)"
          (pointercancel)="scrubEnd($event)"
          >{{ label() }}</span
        >
      }
      <div class="cuf-box">
        @if (isCustom()) {
          <input
            class="cuf-raw"
            type="text"
            spellcheck="false"
            autocomplete="off"
            placeholder="var(--x) / calc(…)"
            [value]="value()"
            (change)="onRawCommit($event)"
            (keydown.enter)="onRawCommit($event)" />
        } @else {
          <input
            class="cuf-num"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            [value]="numText()"
            [placeholder]="placeholder() || fallbackText()"
            [attr.aria-label]="label() || 'value'"
            (input)="onNumInput($event)"
            (change)="onNumCommit($event)"
            (keydown)="onKey($event)" />
          @if (units().length) {
            <select class="cuf-unit" [attr.aria-label]="(label() || 'value') + ' unit'" (change)="onUnit($event)">
              @for (u of units(); track u) {
                <option [value]="u" [selected]="u === unit()">{{ u }}</option>
              }
            </select>
          }
        }
        <button
          type="button"
          class="cuf-btn cuf-fx"
          [class.on]="isCustom()"
          [title]="isCustom() ? 'Back to number' : 'Custom value (var, calc, clamp…)'"
          (click)="toggleCustom()">
          ƒ
        </button>
        <css-var-picker [types]="varTypes()" (picked)="onPickVar($event)"></css-var-picker>
      </div>
    </div>
    @if (slider() && !isCustom()) {
      <input
        class="cuf-range"
        type="range"
        [attr.aria-label]="(label() || 'value') + ' slider'"
        [min]="sliderMin()"
        [max]="sliderMax()"
        [step]="sliderStep() ?? curStep()"
        [value]="sliderValue()"
        (input)="onSlider($event)" />
    }
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .cuf {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    .cuf-label {
      flex: none;
      min-width: 12px;
      font-size: 11px;
      color: #a8a8b2;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cuf-label.scrub {
      cursor: ew-resize;
    }
    .cuf-label.scrub:hover {
      color: #fff;
    }
    .cuf-box {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: stretch;
      height: 26px;
      border-radius: 4px;
      background: #2a2a30;
      border: 1px solid transparent;
      overflow: hidden;
    }
    .cuf-box:focus-within {
      border-color: #4b8bff;
    }
    .cuf.custom .cuf-box {
      background: #242a3a;
    }
    input,
    select {
      all: unset;
      box-sizing: border-box;
      font:
        12px/1 system-ui,
        -apple-system,
        'Segoe UI',
        sans-serif;
      color: #fff;
      height: 100%;
      min-width: 0;
    }
    .cuf-num,
    .cuf-raw {
      flex: 1;
      padding: 0 6px;
    }
    .cuf-num::placeholder,
    .cuf-raw::placeholder {
      color: #6d6d78;
    }
    .cuf-raw {
      font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
      font-size: 11px;
    }
    .cuf-unit {
      flex: none;
      width: 46px;
      padding: 0 2px 0 4px;
      color: #c9c9d2;
      background: #33333a;
      cursor: pointer;
      appearance: auto;
    }
    .cuf-unit:hover {
      color: #fff;
    }
    .cuf-btn {
      all: unset;
      box-sizing: border-box;
      flex: none;
      width: 22px;
      display: grid;
      place-items: center;
      cursor: pointer;
      color: #8a8a96;
      font:
        italic 13px/1 Georgia,
        serif;
    }
    .cuf-btn:hover {
      color: #fff;
      background: #ffffff14;
    }
    .cuf-btn.on {
      color: #4b8bff;
    }
    .cuf-btn:focus-visible {
      outline: 2px solid #4b8bff;
      outline-offset: -2px;
    }
    :host ::ng-deep css-var-picker {
      display: flex;
      align-items: stretch;
    }
    :host ::ng-deep css-var-picker .css-v-btn {
      all: unset;
      box-sizing: border-box;
      width: 22px;
      display: grid;
      place-items: center;
      cursor: pointer;
      font-size: 11px;
    }
    :host ::ng-deep css-var-picker .css-v-btn:hover {
      background: #ffffff14;
    }
    .cuf-range {
      display: block;
      width: 100%;
      height: 16px;
      margin: 4px 0 0;
      cursor: pointer;
      appearance: none;
      -webkit-appearance: none;
      background: transparent;
    }
    .cuf-range::-webkit-slider-runnable-track {
      height: 4px;
      border-radius: 2px;
      background: #46464f;
    }
    .cuf-range::-moz-range-track {
      height: 4px;
      border-radius: 2px;
      background: #46464f;
    }
    .cuf-range::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 12px;
      height: 12px;
      margin-top: -4px;
      border-radius: 50%;
      background: #4b8bff;
      border: 2px solid #1b1a1d;
      box-shadow: 0 0 0 1px #4b8bff;
    }
    .cuf-range::-moz-range-thumb {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #4b8bff;
      border: 2px solid #1b1a1d;
    }
    .cuf-range:focus-visible {
      outline: 2px solid #4b8bff;
      outline-offset: 2px;
      border-radius: 2px;
    }
  `,
})
export class CssUnitFieldComponent {
  label = input<string>('');
  title = input<string>('');
  labelWidth = input<number>(16);
  /** واحدهای مجاز؛ خالی = بدون واحد (مثل scale) */
  units = input<readonly string[]>([]);
  step = input<number>(1);
  /** گام مخصوص هر واحد (مثلاً {ms: 10, s: 0.1}) — اگر نبود از `step` استفاده می‌شود */
  stepByUnit = input<Record<string, number>>({});
  /**
   * ضریب هر واحد نسبت به یک مبنا (مثلاً {ms: 1, s: 1000}). اگر داده شود، با عوض‌کردن واحد
   * «مقدار» تبدیل می‌شود (200ms → 0.2s) نه فقط برچسب؛ برای طول‌ها که تبدیل‌پذیر نیستند ندهید.
   */
  unitFactors = input<Record<string, number>>({});
  min = input<number | undefined>(undefined);
  max = input<number | undefined>(undefined);
  /** مقداری که با خالی‌کردن فیلد جایگزین می‌شود و به‌عنوان placeholder دیده می‌شود */
  fallback = input<string>('0');
  /** متن placeholder (پیش‌فرض: همان fallback) */
  placeholder = input<string>('');
  slider = input<boolean>(false);
  sliderMin = input<number>(0);
  sliderMax = input<number>(100);
  sliderStep = input<number | undefined>(undefined);
  varTypes = input<CssValueType[]>(['text', 'number']);

  /** مقدار CSS (دوطرفه): `[(value)]` */
  value = model<string>('');

  private readonly forcedCustom = signal(false);

  protected readonly parsed = computed(() => parseCssNumber(this.value(), this.units()));
  protected readonly isCustom = computed(
    () => this.forcedCustom() || (this.parsed() === null && this.value().trim() !== ''),
  );
  protected readonly numText = computed(() => {
    const p = this.parsed();
    return p ? trimNum(p.num) : '';
  });
  protected readonly unit = computed(() => this.parsed()?.unit ?? this.units()[0] ?? '');
  protected readonly fallbackText = computed(() => {
    const p = parseCssNumber(this.fallback(), this.units());
    return p ? trimNum(p.num) : this.fallback();
  });
  protected readonly curStep = computed(() => this.stepByUnit()[this.unit()] ?? this.step());
  protected readonly sliderValue = computed(() => this.parsed()?.num ?? parseCssNumber(this.fallback(), this.units())?.num ?? 0);

  //---------------------------------- number ----------------------------------

  private emitNumber(n: number, unit = this.unit()): void {
    const min = this.min();
    const max = this.max();
    if (min !== undefined && n < min) n = min;
    if (max !== undefined && n > max) n = max;
    this.value.set(this.units().length ? `${trimNum(n)}${unit}` : trimNum(n));
  }

  /** فقط وقتی متن یک عدد کامل است emit می‌کنیم؛ حالت‌های میانی مثل «-» یا «.» نادیده گرفته می‌شوند */
  protected onNumInput(ev: Event): void {
    const t = (ev.target as HTMLInputElement).value.trim();
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(t)) return;
    const n = parseFloat(t);
    if (Number.isFinite(n)) this.emitNumber(n);
  }

  protected onNumCommit(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const t = input.value.trim();
    if (t === '') {
      this.value.set(this.fallback());
    } else if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(t)) {
      // متن نامعتبر → برگرد به مقدار قبلی
      input.value = this.numText();
      return;
    }
    input.value = this.numText();
  }

  protected onKey(ev: KeyboardEvent): void {
    if (ev.key === 'Enter') {
      (ev.target as HTMLInputElement).blur();
      return;
    }
    if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') return;
    ev.preventDefault();
    const mult = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1;
    const dir = ev.key === 'ArrowUp' ? 1 : -1;
    const cur = this.parsed()?.num ?? parseCssNumber(this.fallback(), this.units())?.num ?? 0;
    this.emitNumber(cur + dir * this.curStep() * mult);
    (ev.target as HTMLInputElement).value = this.numText();
  }

  protected onUnit(ev: Event): void {
    const unit = (ev.target as HTMLSelectElement).value;
    let cur = this.parsed()?.num ?? parseCssNumber(this.fallback(), this.units())?.num ?? 0;
    const f = this.unitFactors();
    const from = this.unit();
    if (f[from] && f[unit]) cur = Math.round(((cur * f[from]) / f[unit]) * 10000) / 10000;
    this.emitNumber(cur, unit);
  }

  protected onSlider(ev: Event): void {
    this.emitNumber(parseFloat((ev.target as HTMLInputElement).value));
  }

  //---------------------------------- scrub ----------------------------------

  private scrub?: { x: number; start: number };

  protected scrubStart(ev: PointerEvent): void {
    if (this.isCustom() || ev.button !== 0) return;
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    this.scrub = {
      x: ev.clientX,
      start: this.parsed()?.num ?? parseCssNumber(this.fallback(), this.units())?.num ?? 0,
    };
    ev.preventDefault();
  }

  protected scrubMove(ev: PointerEvent): void {
    if (!this.scrub) return;
    const mult = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1;
    const dx = ev.clientX - this.scrub.x;
    this.emitNumber(this.scrub.start + dx * this.curStep() * mult);
  }

  protected scrubEnd(ev: PointerEvent): void {
    if (!this.scrub) return;
    this.scrub = undefined;
    const el = ev.currentTarget as HTMLElement;
    if (el.hasPointerCapture?.(ev.pointerId)) el.releasePointerCapture(ev.pointerId);
  }

  //---------------------------------- custom ----------------------------------

  protected toggleCustom(): void {
    if (this.isCustom()) {
      this.forcedCustom.set(false);
      // مقدار غیرعددی (مثل var) در حالت عددی قابل نمایش نیست → به پیش‌فرض برمی‌گردیم
      if (this.parsed() === null) this.value.set(this.fallback());
    } else {
      this.forcedCustom.set(true);
    }
  }

  protected onRawCommit(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value.trim();
    this.value.set(v || this.fallback());
    // اگر مقدار ساده‌ی عددی شد، به حالت عددی برگرد
    if (this.parsed() !== null) this.forcedCustom.set(false);
  }

  protected onPickVar(cssVar: string): void {
    this.forcedCustom.set(true);
    this.value.set(cssVar);
  }
}
