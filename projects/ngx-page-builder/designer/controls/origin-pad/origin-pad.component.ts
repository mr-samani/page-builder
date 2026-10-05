import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CssUnitFieldComponent } from '../css-unit-field/css-unit-field.component';
import { ORIGIN_STEPS, originCell } from '../transform-control/transform-model';

export interface OriginValue {
  x: string;
  y: string;
}

/**
 * انتخابگر نقطه‌ی مبدا (transform-origin / perspective-origin):
 * شبکه‌ی ۳×۳ برای انتخاب سریع + دو فیلد X/Y برای مقدار دقیق (%، px، ...).
 * مقدار از بیرون داده می‌شود و تغییر از خروجی `changed` می‌آید (جریان یک‌طرفه).
 */
@Component({
  selector: 'origin-pad',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CssUnitFieldComponent],
  template: `
    <div class="op" [class.unset]="!isSet()">
      <div class="op-grid" role="group" [attr.aria-label]="ariaLabel()">
        @for (r of steps; track r; let row = $index) {
          @for (c of steps; track c; let col = $index) {
            <button
              type="button"
              class="op-cell"
              [class.on]="cell()?.col === col && cell()?.row === row"
              [attr.aria-pressed]="cell()?.col === col && cell()?.row === row"
              [title]="c + ' ' + r"
              (click)="pick(c, r)"></button>
          }
        }
      </div>
      <div class="op-fields">
        <css-unit-field
          label="X"
          [units]="units"
          fallback="50%"
          [step]="1"
          [value]="x()"
          (valueChange)="changed.emit({ x: $event, y: y() })" />
        <css-unit-field
          label="Y"
          [units]="units"
          fallback="50%"
          [step]="1"
          [value]="y()"
          (valueChange)="changed.emit({ x: x(), y: $event })" />
      </div>
    </div>
  `,
  styles: `
    .op {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .op.unset .op-grid {
      opacity: 0.55;
    }
    .op-grid {
      flex: none;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(3, 1fr);
      width: 60px;
      height: 60px;
      padding: 3px;
      border-radius: 6px;
      background: #2a2a30;
      border: 1px solid #3c3c44;
      position: relative;
    }
    /* خطوط راهنما: شکل «#» پشت نقطه‌ها */
    .op-grid::before {
      content: '';
      position: absolute;
      inset: 11px;
      background:
        linear-gradient(#46464f, #46464f) 50% 0 / 1px 100% no-repeat,
        linear-gradient(#46464f, #46464f) 0 50% / 100% 1px no-repeat;
      pointer-events: none;
    }
    .op-cell {
      all: unset;
      position: relative;
      box-sizing: border-box;
      cursor: pointer;
      display: grid;
      place-items: center;
      border-radius: 4px;
    }
    .op-cell::after {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #7a7a86;
      transition:
        transform 0.12s,
        background 0.12s;
    }
    .op-cell:hover::after {
      background: #fff;
      transform: scale(1.3);
    }
    .op-cell.on::after {
      width: 10px;
      height: 10px;
      background: #4b8bff;
      box-shadow: 0 0 0 3px #4b8bff44;
    }
    .op-cell:focus-visible {
      outline: 2px solid #4b8bff;
    }
    .op-fields {
      flex: 1;
      min-width: 0;
      display: grid;
      gap: 6px;
    }
  `,
})
export class OriginPadComponent {
  x = input<string>('50%');
  y = input<string>('50%');
  /** آیا مقدار واقعاً ست شده؟ (false = فقط پیش‌فرض را نشان می‌دهیم، کمرنگ) */
  isSet = input<boolean>(true);
  ariaLabel = input<string>('Origin');
  changed = output<OriginValue>();

  protected readonly steps = ORIGIN_STEPS;
  protected readonly units = ['%', 'px', 'em', 'rem'] as const;
  protected readonly cell = computed(() => originCell({ x: this.x(), y: this.y() }));

  protected pick(x: string, y: string): void {
    this.changed.emit({ x, y });
  }
}
