import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { DynamicDataService, DynamicDataStructure, DynamicValueType, PageItem } from 'ngx-page-builder/core';

export interface DataSourceSelection {
  dataSourceId: string;
  path: string;
  field: DynamicDataStructure;
  dataSource: DynamicDataStructure;
}

interface SelectorLevel {
  depth: number;
  options: DynamicDataStructure[];
  selected: string;
}

@Component({
  selector: 'data-source-selector',
  standalone: true,
  templateUrl: './data-source-selector.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataSourceSelectorComponent {
  protected readonly ds = inject(DynamicDataService);
  readonly item = input.required<PageItem>();
  readonly collection = input.required<boolean>();

  /** Available data sources */
  readonly dataSources = computed(() =>
    this.ds.dynamicData.filter((x) =>
      this.collection() ? x.type == DynamicValueType.Array : x.type != DynamicValueType.Array,
    ),
  );

  /** Labels */
  readonly dataSourceLabel = input('Data Source');
  readonly placeholder = input('Select field...');
  readonly dataSourcePlaceholder = input('Select data source...');

  /** Output when the data source changes */
  readonly dataSourceChange = output<string | null>();

  /** Output when the selected path changes */
  readonly pathChange = output<string>();

  /** Complete selection, emitted only when a valid field is selected */
  readonly selectionChange = output<DataSourceSelection | null>();

  protected readonly selectedDataSource = computed(
    () => this.dataSources().find((source) => source.id === this.item().dataSource.id) ?? null,
  );

  protected readonly levels = computed<SelectorLevel[]>(() => {
    const source = this.selectedDataSource();

    if (!source) return [];

    const path = (this.item().dataSource.binding ?? '').split('.').filter(Boolean);

    const result: SelectorLevel[] = [];
    let options = source.fields ?? [];

    for (let depth = 0; options.length > 0; depth++) {
      const selected = path[depth] ?? '';

      result.push({
        depth,
        options,
        selected,
      });

      if (!selected) break;

      const selectedField = options.find((field) => field.name === selected);

      if (!selectedField) break;

      options = selectedField.fields ?? [];
    }

    return result;
  });

  protected onDataSourceChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value || null;

    this.dataSourceChange.emit(id);
    this.pathChange.emit('');
    this.selectionChange.emit(null);
  }

  protected onFieldChange(depth: number, event: Event): void {
    const name = (event.target as HTMLSelectElement).value;

    const currentPath = (this.item().dataSource.binding ?? '').split('.').filter(Boolean);

    const nextPath = currentPath.slice(0, depth);

    if (name) {
      nextPath.push(name);
    }

    const path = nextPath.join('.');

    this.pathChange.emit(path);
    this.item().dataSource.binding = path;
    this.item().content = `{{${path}}}`;

    if (!name) {
      this.selectionChange.emit(null);
      return;
    }

    const source = this.selectedDataSource();

    if (!source) {
      this.selectionChange.emit(null);
      return;
    }

    const field = this.findField(source.fields ?? [], nextPath);

    if (!field) {
      this.selectionChange.emit(null);
      return;
    }

    this.selectionChange.emit({
      dataSourceId: source.id!,
      path,
      field,
      dataSource: source,
    });
  }

  private findField(fields: DynamicDataStructure[], path: string[]): DynamicDataStructure | null {
    let currentFields = fields;
    let current: DynamicDataStructure | undefined;

    for (const segment of path) {
      current = currentFields.find((field) => field.name === segment);

      if (!current) return null;

      currentFields = current.fields ?? [];
    }

    return current ?? null;
  }
}
