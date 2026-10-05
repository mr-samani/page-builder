import { ChangeDetectionStrategy, Component, computed, input, output, signal, viewChild } from '@angular/core';
import { CssUnitFieldComponent } from '../css-unit-field/css-unit-field.component';
import { PbPopoverComponent } from '../popover/pb-popover.component';
import { Track, makeTrack, parseTracks, serializeTracks, trackLabel } from './display-model';

/**
 * ویرایشگر track های grid (ستون‌ها یا ردیف‌ها)، مثل پنل Grid در Webflow:
 *  - هر track یک «چیپ» است؛ کلیک → ویرایش اندازه (fr / px / % / auto / min / max / minmax(...))
 *  - «+» track جدید اضافه می‌کند
 *  - اگر مقدار فعلی با چیپ‌ها قابل نمایش نباشد (auto-fill، نام خط‌ها، subgrid) خودکار به حالت متنی می‌رود
 */
@Component({
  selector: 'grid-tracks',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CssUnitFieldComponent, PbPopoverComponent],
  template: `
    <div class="gt" [attr.data-pb-popover-group]="group()">
      <div class="gt-head">
        <span class="gt-title">{{ label() }}</span>
        <span class="gt-count">{{ countText() }}</span>
        <span class="gt-spacer"></span>
        @if (tracks() !== null) {
          <button type="button" class="gt-link" [class.on]="textMode()" (click)="toggleText()" title="Edit as CSS text">
            {{ '{ }' }}
          </button>
        }
      </div>

      @if (tracks() === null || textMode()) {
        <input
          class="gt-raw"
          type="text"
          spellcheck="false"
          autocomplete="off"
          [attr.aria-label]="label() + ' template'"
          [placeholder]="kind() === 'column' ? 'e.g. 1fr 200px / repeat(3, 1fr)' : 'e.g. auto 1fr auto'"
          [value]="value()"
          (change)="onRaw($event)"
          (keydown.enter)="onRaw($event)" />
        @if (tracks() === null) {
          <p class="gt-note">
            Advanced template (auto-fill, named lines…). Edited as text so nothing is lost.
            <button type="button" class="gt-link" (click)="resetTracks()">Switch to tracks</button>
          </p>
        }
      } @else {
        <div class="gt-strip" role="list">
          @for (t of tracks()!; track t.uid; let i = $index) {
            <button
              #chip
              type="button"
              role="listitem"
              class="gt-chip"
              [class.on]="selected() === t.uid"
              [attr.data-uid]="t.uid"
              [title]="kind() + ' ' + (i + 1) + ': ' + t.value"
              (click)="toggle(t.uid, chip)">
              <span class="gt-chip-idx">{{ i + 1 }}</span>
              <span class="gt-chip-val">{{ label2(t.value) }}</span>
            </button>
          }
          <button #addBtn type="button" class="gt-chip add" [title]="'Add ' + kind()" [attr.aria-label]="'Add ' + kind()" (click)="add()">
            +
          </button>
        </div>
      }
    </div>

    <pb-popover #pop [heading]="heading()" [group]="group()" [width]="260" (closed)="selected.set(null)">
      @if (pop.isOpen() && current(); as t) {
        <css-unit-field
          label="Size"
          [labelWidth]="28"
          [units]="units"
          [step]="stepFor(t.value)"
          [min]="0"
          fallback="1fr"
          [value]="t.value"
          (valueChange)="setValue(t.uid, $event)" />
        <div class="gt-kw" role="group" aria-label="Keywords">
          @for (k of keywords; track k.value) {
            <button type="button" [class.on]="t.value === k.value" (click)="setValue(t.uid, k.value)">{{ k.label }}</button>
          }
        </div>
        <div class="gt-acts">
          <button type="button" [disabled]="index() === 0" (click)="shift(t.uid, -1)" title="Move earlier">◀ Move</button>
          <button type="button" [disabled]="index() === count() - 1" (click)="shift(t.uid, 1)" title="Move later">Move ▶</button>
          <button type="button" class="del" (click)="remove(t.uid)">Delete</button>
        </div>
        <p class="gt-note">Tip: use <b>ƒ</b> for minmax(), fit-content() or var().</p>
      }
    </pb-popover>
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
    .gt-head {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }
    .gt-title {
      font-size: 11px;
      color: #a8a8b2;
    }
    .gt-count {
      font-size: 10px;
      color: #6d6d78;
    }
    .gt-spacer {
      flex: 1;
    }
    .gt-link {
      all: unset;
      cursor: pointer;
      font-size: 11px;
      color: #7aa7ff;
      padding: 1px 4px;
      border-radius: 3px;
      font-family: ui-monospace, Menlo, Consolas, monospace;
    }
    .gt-link:hover,
    .gt-link.on {
      background: #4b8bff22;
      color: #a9c6ff;
    }
    .gt-link:focus-visible {
      outline: 2px solid #4b8bff;
    }
    .gt-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 3px;
    }
    .gt-chip {
      all: unset;
      box-sizing: border-box;
      min-width: 44px;
      max-width: 120px;
      height: 26px;
      padding: 0 8px 0 5px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border-radius: 4px;
      background: #2f2f37;
      border: 1px solid transparent;
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.02em;
      flex: 1 1 44px;
    }
    .gt-chip:hover {
      background: #3a3a44;
    }
    .gt-chip.on {
      background: #243153;
      border-color: #4b8bff;
    }
    .gt-chip:focus-visible {
      outline: 2px solid #4b8bff;
    }
    .gt-chip-idx {
      flex: none;
      min-width: 14px;
      height: 14px;
      border-radius: 3px;
      display: grid;
      place-items: center;
      background: #ffffff14;
      color: #9a9aa6;
      font-size: 9px;
      font-weight: 500;
    }
    .gt-chip-val {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .gt-chip.add {
      flex: none;
      min-width: 26px;
      width: 26px;
      padding: 0;
      justify-content: center;
      background: transparent;
      border: 1px dashed #4a4a54;
      color: #c9c9d2;
      font-size: 14px;
    }
    .gt-chip.add:hover {
      border-color: #4b8bff;
      color: #fff;
    }
    .gt-raw {
      all: unset;
      box-sizing: border-box;
      display: block;
      width: 100%;
      height: 26px;
      padding: 0 8px;
      border-radius: 4px;
      background: #2a2a30;
      color: #fff;
      font:
        11px/1 ui-monospace,
        Menlo,
        Consolas,
        monospace;
    }
    .gt-raw:focus {
      outline: 1px solid #4b8bff;
    }
    .gt-note {
      margin: 6px 0 0;
      font-size: 10.5px;
      color: #7c7c88;
    }
    .gt-kw {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
      margin-top: 10px;
    }
    .gt-kw button,
    .gt-acts button {
      all: unset;
      box-sizing: border-box;
      height: 24px;
      display: grid;
      place-items: center;
      border-radius: 4px;
      background: #2a2a30;
      color: #c9c9d2;
      font-size: 11px;
      cursor: pointer;
    }
    .gt-kw button:hover,
    .gt-acts button:hover:not(:disabled) {
      background: #3a3a44;
      color: #fff;
    }
    .gt-kw button.on {
      background: #4b8bff;
      color: #fff;
    }
    .gt-acts {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 4px;
      margin-top: 10px;
    }
    .gt-acts button:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .gt-acts .del:hover {
      background: #e5484d66;
    }
    .gt-kw button:focus-visible,
    .gt-acts button:focus-visible {
      outline: 2px solid #4b8bff;
    }
  `,
})
export class GridTracksComponent {
  label = input<string>('Columns');
  kind = input<'column' | 'row'>('column');
  /** مقدار CSS فعلی (grid-template-columns یا -rows) */
  value = input<string>('');
  changed = output<string>();

  protected readonly units = ['fr', 'px', '%', 'em', 'rem', 'vw', 'vh'] as const;
  protected readonly keywords = [
    { value: 'auto', label: 'Auto' },
    { value: 'min-content', label: 'Min' },
    { value: 'max-content', label: 'Max' },
  ];

  protected readonly group = computed(() => `gt-${this.kind()}`);
  protected readonly heading = computed(() => (this.kind() === 'column' ? 'Column' : 'Row') + ' size');
  private readonly pop = viewChild.required<PbPopoverComponent>('pop');

  /** track های در حال ویرایش؛ با تغییر ورودی از بیرون دوباره پارس می‌شوند، با ویرایش داخلی نگه داشته می‌شوند */
  private readonly local = signal<{ src: string; list: Track[] } | null>(null);
  protected readonly selected = signal<number | null>(null);
  protected readonly textMode = signal(false);

  protected readonly tracks = computed<Track[] | null>(() => {
    const v = this.value();
    const l = this.local();
    // اگر ورودی همان چیزی است که خودمان نوشتیم، uid ها را حفظ می‌کنیم (چیپ انتخاب‌شده نپرد)
    if (l && l.src === v) return l.list;
    return parseTracks(v);
  });
  protected readonly count = computed(() => this.tracks()?.length ?? 0);
  protected readonly countText = computed(() => {
    const n = this.count();
    return this.tracks() === null ? 'custom' : `${n} ${this.kind()}${n === 1 ? '' : 's'}`;
  });
  protected readonly current = computed(() => this.tracks()?.find((t) => t.uid === this.selected()) ?? null);
  protected readonly index = computed(() => this.tracks()?.findIndex((t) => t.uid === this.selected()) ?? -1);

  protected label2(v: string): string {
    return trackLabel(v);
  }
  protected stepFor(v: string): number {
    return /fr$/i.test(v.trim()) ? 0.25 : 1;
  }

  private commit(list: Track[]): void {
    const css = serializeTracks(list);
    this.local.set({ src: css, list });
    this.changed.emit(css);
  }

  protected add(): void {
    const list = [...(this.tracks() ?? [])];
    const t = makeTrack(this.kind() === 'column' ? '1fr' : 'auto');
    list.push(t);
    this.commit(list);
  }

  protected toggle(uid: number, chip: HTMLElement): void {
    if (this.selected() === uid && this.pop().isOpen()) {
      this.pop().close();
      return;
    }
    this.selected.set(uid);
    if (this.pop().isOpen()) this.pop().moveTo(chip);
    else this.pop().open(chip);
  }

  protected setValue(uid: number, value: string): void {
    const v = value.trim();
    if (!v) return;
    this.commit((this.tracks() ?? []).map((t) => (t.uid === uid ? { ...t, value: v } : t)));
  }

  protected remove(uid: number): void {
    this.pop().close();
    this.commit((this.tracks() ?? []).filter((t) => t.uid !== uid));
  }

  protected shift(uid: number, dir: -1 | 1): void {
    const list = [...(this.tracks() ?? [])];
    const i = list.findIndex((t) => t.uid === uid);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    this.commit(list);
  }

  protected toggleText(): void {
    this.pop().close();
    this.textMode.update((v) => !v);
  }

  protected onRaw(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value.trim();
    this.local.set(null);
    this.changed.emit(v);
  }

  protected resetTracks(): void {
    this.local.set(null);
    this.textMode.set(false);
    this.changed.emit(this.kind() === 'column' ? '1fr 1fr' : 'auto auto');
  }
}
