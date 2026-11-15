import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import {
  DynamicDataService,
  DynamicDataStructure,
  findField,
  isBindableField,
  isLeafField,
} from 'ngx-page-builder/core';

/**
 * - object     : the first select is the data source (namespace), the next ones are its fields
 * - collection : the first select is already a field of one record of the collection `collectionId`
 */
export type BindingScope = 'object' | 'collection';

export interface DataSourceSelection {
  /** the data source (object source, or the collection) */
  dataSource: DynamicDataStructure;
  /** the value to store in `dataSource.binding` */
  path: string;
  /** the chosen field */
  field: DynamicDataStructure;
}

interface SelectorLevel {
  depth: number;
  options: DynamicDataStructure[];
  selected: string;
}

/**
 * Picks ONE value field (a field that is not an object or a list) of the data structure.
 * It works only with the structure: no data is needed. `pathChange` is emitted when a value field is chosen, or
 * with an empty string when everything is cleared; choosing an object only opens the next select.
 */
@Component({
  selector: 'data-source-selector',
  standalone: true,
  templateUrl: './data-source-selector.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataSourceSelectorComponent {
  private readonly ds = inject(DynamicDataService);

  readonly scope = input.required<BindingScope>();
  /** id of the collection (scope `collection`) */
  readonly collectionId = input<string>();
  /** the stored binding */
  readonly path = input<string>('');
  readonly sourcePlaceholder = input('Select a data source…');
  readonly placeholder = input('Select a field…');

  readonly pathChange = output<string>();
  readonly selectionChange = output<DataSourceSelection | null>();

  /** what is chosen in the selects (follows `path`, but can be incomplete while the user is choosing) */
  protected readonly segments = linkedSignal(() => this.path().split('.').filter(Boolean));

  /** what the first select offers. Lists can never be bound to a block, so they are not offered */
  private readonly rootOptions = computed<DynamicDataStructure[]>(() => {
    if (this.scope() === 'collection') {
      return (this.ds.findDataSource(this.collectionId())?.fields ?? []).filter(isBindableField);
    }
    return this.ds.objectSources;
  });

  protected readonly levels = computed<SelectorLevel[]>(() => {
    const segments = this.segments();
    const levels: SelectorLevel[] = [];
    let options = this.rootOptions();
    for (let depth = 0; options.length; depth++) {
      const selected = segments[depth] ?? '';
      levels.push({ depth, options, selected });
      const node = options.find((o) => o.name === selected);
      if (!node || isLeafField(node)) break;
      options = (node.fields ?? []).filter(isBindableField);
    }
    return levels;
  });

  protected label(field: DynamicDataStructure): string {
    return (field.displayName || field.name) + (isLeafField(field) ? '' : ' ›');
  }

  protected emptyLabel(depth: number): string {
    if (depth > 0) return 'Select nested field…';
    return this.scope() === 'object' ? this.sourcePlaceholder() : this.placeholder();
  }

  protected onSelect(depth: number, event: Event) {
    const name = (event.target as HTMLSelectElement).value;
    const segments = this.segments().slice(0, depth);
    if (name) segments.push(name);
    this.segments.set(segments);

    if (!segments.length) {
      this.pathChange.emit('');
      this.selectionChange.emit(null);
      return;
    }

    const selection = this.resolve(segments);
    if (selection) {
      this.pathChange.emit(selection.path);
      this.selectionChange.emit(selection);
    }
  }

  /** the selection, only when the segments end at a value field */
  private resolve(segments: string[]): DataSourceSelection | null {
    const path = segments.join('.');
    if (this.scope() === 'collection') {
      const dataSource = this.ds.findDataSource(this.collectionId());
      const field = findField(dataSource?.fields, path);
      return dataSource && field && isLeafField(field) ? { dataSource, path, field } : null;
    }

    const [name, ...rest] = segments;
    const dataSource = this.ds.findDataSourceByName(name);
    if (!dataSource) return null;
    // an object source can also be a single value (no fields)
    const field = rest.length ? findField(dataSource.fields, rest.join('.')) : dataSource;
    return field && isLeafField(field) ? { dataSource, path, field } : null;
  }
}
