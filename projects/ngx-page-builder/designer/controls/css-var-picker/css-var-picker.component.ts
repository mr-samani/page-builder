import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { CssValueType, ICssVariable, LibConsts } from 'ngx-page-builder/core';
import { ClassManagerService } from '../../services/class-manager.service';
import { MenuDialog } from '../../extensions/menu-dialog/menu-dialog.component';

/**
 * دکمه‌ی کوچک «انتخاب از متغیرهای CSS» که کنار هر فیلد قرار می‌گیرد.
 * مقدار انتخاب‌شده به‌صورت `var(--name)` از خروجی `picked` می‌آید؛ خود کنترل تصمیم می‌گیرد کجا بنویسد.
 *
 * @example
 * <css-var-picker [types]="['text','number']" (picked)="onPickVar('width', $event)"></css-var-picker>
 */
@Component({
  selector: 'css-var-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MenuDialog],
  template: `
    @if (enabled) {
      <button #btn class="pb-btn css-v-btn" type="button" title="CSS variables" (click)="open(dialog)">📐</button>
      <menu-dialog #dialog [target]="btn">
        <div role="header">{{ title() || 'CSS variables' }}</div>
        <div class="pb-input-group pi-row">
          <input type="text" placeholder="Search..." [ngModel]="filter()" (ngModelChange)="filter.set($event)" />
        </div>
        <div class="list-container">
          @for (v of filtered(); track v.name) {
            <div class="list-item" (click)="pick(v, dialog)">
              <div>{{ v.name }}</div>
              <div [title]="v.value">
                @switch (v.type) {
                  @case ('color') {
                    <span class="value" [style.backgroundColor]="v.value">{{ v.value }}</span>
                  }
                  @case ('gradient') {
                    <span class="value" [style.background]="v.value">{{ v.value }}</span>
                  }
                  @default {
                    <span class="value">{{ v.value }}</span>
                  }
                }
              </div>
            </div>
          } @empty {
            <div class="list-item"><div>No variables</div></div>
          }
        </div>
      </menu-dialog>
    }
  `,
  styles: `
    .css-v-btn {
      padding: 2px !important;
    }
    .list-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      padding: 8px;
      border-bottom: 1px #7d7d7d4a solid;
    }
    .list-item:hover {
      background-color: #009dff13;
    }
    .list-item div {
      width: 50%;
    }
    .value {
      background: #4f4f4f;
      padding: 5px 10px;
      border-radius: 5px;
      max-width: 150px;
      display: inline-block;
      overflow: hidden;
    }
  `,
})
export class CssVarPickerComponent {
  /** فقط متغیرهای این نوع‌ها نمایش داده می‌شوند (مثلاً برای اندازه: text و number) */
  types = input<CssValueType[]>(['text', 'number', 'color', 'gradient']);
  title = input<string>('');
  picked = output<string>();

  protected readonly enabled = LibConsts.enableCssVariable;
  protected filter = signal('');

  private readonly cls = inject(ClassManagerService);
  private readonly vars = toSignal(this.cls.cssVariables$, { initialValue: this.cls.cssVariables });

  protected filtered = computed<ICssVariable[]>(() => {
    const q = this.filter().trim().toLowerCase();
    const types = this.types();
    return this.vars().filter((v) => types.includes(v.type) && (!q || v.name.toLowerCase().includes(q)));
  });

  protected open(dialog: MenuDialog) {
    this.filter.set('');
    dialog.showModal();
  }

  protected pick(v: ICssVariable, dialog: MenuDialog) {
    this.picked.emit(`var(--${v.name})`);
    dialog.closeModal();
  }
}
