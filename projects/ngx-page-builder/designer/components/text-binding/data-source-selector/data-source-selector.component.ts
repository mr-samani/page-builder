import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { DynamicDataStructure } from 'ngx-page-builder/core';

interface SelectorLevel {
  options: DynamicDataStructure[];
  selected: string;
}

/**
 * Picks a field of a data structure (object or collection record).
 * - `fields`: the structure (top level fields; nested fields are read from `values`)
 * - `value` : selected path, nested fields are joined with dots (`address.city`)
 * One <select> is rendered per level, the next level appears when the selected field has children.
 */
@Component({
  selector: 'data-source-selector',
  templateUrl: './data-source-selector.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataSourceSelectorComponent {
  readonly fields = input<DynamicDataStructure[]>([]);
  readonly placeholder = input('Select…');
  readonly value = model<string>('');

  protected readonly levels = computed<SelectorLevel[]>(() => {
    const parts = (this.value() ?? '').split('.').filter(Boolean);
    const levels: SelectorLevel[] = [];
    let options = this.fields() ?? [];
    for (let depth = 0; options.length > 0; depth++) {
      const selected = parts[depth] ?? '';
      levels.push({ options, selected });
      if (!selected) break;
      options = options.find((f) => f.name === selected)?.values ?? [];
    }
    return levels;
  });

  protected onSelect(depth: number, event: Event) {
    const name = (event.target as HTMLSelectElement).value;
    const path = (this.value() ?? '').split('.').filter(Boolean).slice(0, depth);
    if (name) path.push(name);
    this.value.set(path.join('.'));
  }
}
