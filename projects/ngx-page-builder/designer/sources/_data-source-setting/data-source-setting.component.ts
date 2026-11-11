import { ChangeDetectionStrategy, Component, DestroyRef, forwardRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  DATA_FILTER_OPERATORS,
  DataSourceSetting,
  DynamicDataInputParameter,
  DynamicDataInputType,
  DynamicDataService,
  DynamicDataStructure,
  DynamicValueType,
  FlatField,
} from 'ngx-page-builder/core';
import { debounceTime, Subject } from 'rxjs';
import { NgxIconComponent } from 'ngx-page-builder/icons';

/**
 * Settings of a collection data source (like Webflow's collection list settings):
 * data source, filters, sort, skip / limit and the custom input parameters of the source.
 */
@Component({
  selector: 'data-source-setting',
  templateUrl: './data-source-setting.component.html',
  styleUrls: ['./data-source-setting.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NgxIconComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DataSourceSettingComponent),
      multi: true,
    },
  ],
})
export class DataSourceSettingComponent implements ControlValueAccessor {
  private readonly dynamicDataService = inject(DynamicDataService);

  readonly collectionDataSource: DynamicDataStructure[] = this.dynamicDataService.dynamicData.filter(
    (x) => x.type == DynamicValueType.Array,
  );
  readonly operators = DATA_FILTER_OPERATORS;
  readonly DynamicDataInputType = DynamicDataInputType;

  settings = new DataSourceSetting();
  /** copies of the source input parameters (the shared definitions are never modified) */
  otherFields: DynamicDataInputParameter[] = [];
  /** fields of the selected source: available for filter / sort even if the source has no records */
  readonly fieldOptions = signal<FlatField[]>([]);
  isDisabled = false;

  private readonly settingChange$ = new Subject<DataSourceSetting>();
  private onChange: (value: DataSourceSetting) => void = () => {};
  onTouched: () => void = () => {};

  constructor() {
    this.settingChange$
      .pipe(debounceTime(300), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((value) => this.onChange(value));
  }

  /* ------------------------ ControlValueAccessor ------------------------ */

  writeValue(obj?: DataSourceSetting): void {
    this.settings = obj ?? new DataSourceSetting();
    this.syncSource();
  }
  registerOnChange(fn: (value: DataSourceSetting) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }

  /* ------------------------------ source ------------------------------ */

  /** reloads input parameters and the field list of the selected data source */
  private async syncSource() {
    const id = this.settings.id;
    const source = this.collectionDataSource.find((x) => x.id === id);
    this.otherFields = (source?.inputData ?? []).map((f) => ({
      ...f,
      value: this.settings.params?.[f.name] ?? f.value,
    }));
    //todo
    //this.fieldOptions.set(flattenFields(this.dynamicDataService.getSchema(id)));
    // lazy sources (API): the structure is discovered with one record
    //this.fieldOptions.set(flattenFields(await this.dynamicDataService.resolveSchema(id)));
  }

  onChangeDataSource() {
    // filters / sorts / params belong to the previous structure
    this.settings.filters = [];
    this.settings.sorts = [];
    this.settings.params = undefined;
    this.syncSource();
    this.update();
  }

  update() {
    this.settingChange$.next(this.settings);
  }

  updateParam(item: DynamicDataInputParameter) {
    this.settings.params ??= {};
    this.settings.params[item.name] = item.value;
    this.update();
  }

  /* ----------------------------- filters ----------------------------- */

  addFilter() {
    const first = this.fieldOptions()[0];
    (this.settings.filters ??= []).push({ field: first?.path ?? '', operator: 'eq', value: '' });
    this.update();
  }
  removeFilter(index: number) {
    this.settings.filters?.splice(index, 1);
    this.update();
  }
  needsValue(operator: string): boolean {
    return this.operators.find((o) => o.value === operator)?.needsValue ?? true;
  }

  /* ------------------------------ sorts ------------------------------ */

  addSort() {
    const first = this.fieldOptions()[0];
    (this.settings.sorts ??= []).push({ field: first?.path ?? '', direction: 'asc' });
    this.update();
  }
  removeSort(index: number) {
    this.settings.sorts?.splice(index, 1);
    this.update();
  }
}
