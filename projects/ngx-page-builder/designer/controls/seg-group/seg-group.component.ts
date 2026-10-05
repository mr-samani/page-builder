import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { Rect } from '../display-control/display-model';

export interface SegOption {
  value: string;
  label: string;
  /** tooltip؛ پیش‌فرض = label */
  title?: string;
  /** آیکن توپر (viewBox 16×16) */
  rects?: Rect[];
  /** آیکن خطی (viewBox 16×16، stroke) */
  paths?: string[];
  /** متن کوتاه به‌جای آیکن */
  text?: string;
}

/**
 * گروه دکمه‌های انتخاب (segmented control) برای مقدارهای enum مثل display / align / direction.
 *
 *  - `clearable`: کلیک روی گزینه‌ی فعال، مقدار را پاک می‌کند (خروجی '')
 *  - `inherited`: گزینه‌ای که مقدار «مؤثر» است ولی خود کاربر ست نکرده، با حاشیه‌ی خط‌چین نشان داده می‌شود
 *  - `normalize`: برای هم‌ارزی مقدارها (start ≡ flex-start)
 *  - کلیدهای جهتی ← → ↑ ↓ بین گزینه‌ها جابه‌جا می‌شوند (roving tabindex)
 */
@Component({
  selector: 'pb-seg',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="seg"
      role="radiogroup"
      [attr.aria-label]="ariaLabel()"
      [style.--cols]="columns() || options().length"
      (keydown)="onKey($event)">
      @for (o of options(); track o.value) {
        <button
          type="button"
          role="radio"
          class="seg-btn"
          [class.on]="isOn(o)"
          [class.inh]="!active() && !!inherited() && same(inherited(), o.value)"
          [class.has-text]="!!o.text || showLabels()"
          [attr.aria-checked]="isOn(o)"
          [attr.tabindex]="isTabStop(o) ? 0 : -1"
          [attr.data-value]="o.value"
          [title]="o.title || o.label"
          (click)="pick(o)">
          @if (o.rects || o.paths) {
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
              @for (r of o.rects ?? []; track $index) {
                <rect [attr.x]="r.x" [attr.y]="r.y" [attr.width]="r.w" [attr.height]="r.h" rx="0.8" />
              }
              @for (d of o.paths ?? []; track $index) {
                <path [attr.d]="d" />
              }
            </svg>
          }
          @if (o.text) {
            <span class="seg-text">{{ o.text }}</span>
          } @else if (showLabels()) {
            <span class="seg-text">{{ o.label }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .seg {
      display: grid;
      grid-template-columns: repeat(var(--cols, 1), minmax(0, 1fr));
      gap: 2px;
      padding: 2px;
      border-radius: 6px;
      background: #2a2a30;
    }
    .seg-btn {
      all: unset;
      box-sizing: border-box;
      min-width: 0;
      height: 26px;
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1px;
      border-radius: 4px;
      color: #a8a8b2;
      cursor: pointer;
      font:
        11px/1.1 system-ui,
        -apple-system,
        'Segoe UI',
        sans-serif;
      transition:
        background 0.1s,
        color 0.1s;
    }
    .seg-btn.has-text {
      flex-direction: row;
      gap: 4px;
      padding: 0 4px;
    }
    .seg-btn svg {
      flex: none;
    }
    .seg-btn svg rect {
      fill: currentColor;
    }
    .seg-btn svg path {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .seg-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .seg-btn:hover {
      background: #ffffff14;
      color: #fff;
    }
    .seg-btn.on {
      background: #4b8bff;
      color: #fff;
    }
    .seg-btn.inh {
      color: #c9c9d2;
      box-shadow: inset 0 0 0 1px #5b5b66;
      background: repeating-linear-gradient(135deg, transparent 0 3px, #ffffff0a 3px 6px);
    }
    .seg-btn:focus-visible {
      outline: 2px solid #fff;
      outline-offset: -2px;
    }
  `,
})
export class SegGroupComponent {
  options = input.required<readonly SegOption[]>();
  value = input<string>('');
  /** مقدار مؤثر ولی ست‌نشده توسط کاربر (مثلاً از کلاس یا Bootstrap) */
  inherited = input<string>('');
  clearable = input<boolean>(true);
  showLabels = input<boolean>(false);
  /** تعداد ستون؛ پیش‌فرض = تعداد گزینه‌ها (یک ردیف) */
  columns = input<number>(0);
  ariaLabel = input<string>('');
  normalize = input<(v: string) => string>((v) => v);

  picked = output<string>();

  protected readonly active = computed(() => this.options().some((o) => this.isOn(o)));

  protected same(a: string, b: string): boolean {
    const n = this.normalize();
    return n(a) === n(b);
  }

  protected isOn(o: SegOption): boolean {
    const v = this.value();
    return v !== '' && this.same(v, o.value);
  }

  /** تنها یک دکمه در ترتیب Tab است: فعال، وگرنه اولی */
  protected isTabStop(o: SegOption): boolean {
    const opts = this.options();
    const on = opts.find((x) => this.isOn(x));
    return on ? on === o : opts[0] === o;
  }

  protected pick(o: SegOption): void {
    if (this.isOn(o)) {
      if (this.clearable()) this.picked.emit('');
      return;
    }
    this.picked.emit(o.value);
  }

  protected onKey(ev: KeyboardEvent): void {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(ev.key)) return;
    const group = ev.currentTarget as HTMLElement;
    const btns = Array.from(group.querySelectorAll<HTMLButtonElement>('.seg-btn'));
    const cur = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (cur < 0) return;
    ev.preventDefault();
    let next = cur;
    if (ev.key === 'Home') next = 0;
    else if (ev.key === 'End') next = btns.length - 1;
    else next = (cur + (ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length;
    btns[next].focus();
  }
}
