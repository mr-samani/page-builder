import { ChangeDetectionStrategy, Component, forwardRef, OnInit } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  DataSourceSetting,
  DynamicDataInputParameter,
  DynamicDataInputType,
  DynamicDataService,
  DynamicDataStructure,
} from 'ngx-page-builder/core';
import { debounce, debounceTime, distinctUntilChanged, observable, Observable, Subject, throttleTime } from 'rxjs';

@Component({
  selector: 'data-source-setting',
  templateUrl: './data-source-setting.component.html',
  styleUrls: ['./data-source-setting.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DataSourceSettingComponent),
      multi: true,
    },
  ],
})
export class DataSourceSettingComponent implements OnInit, ControlValueAccessor {
  collectionDataSource: DynamicDataStructure[] = [];
  settings = new DataSourceSetting();
  otherFields: DynamicDataInputParameter[] = [];

  isDisabled: boolean = false;

  settingChange$ = new Subject<DataSourceSetting>();
  onChange = (_: DataSourceSetting) => {};
  onTouched = () => {};
  constructor(public dynamicDataService: DynamicDataService) {
    this.collectionDataSource = this.dynamicDataService.dynamicData.filter((x: DynamicDataStructure) => x.list);

    this.settingChange$
      .pipe(
        //distinctUntilChanged(),
        debounceTime(300),
      )
      .subscribe((input) => {
        this.onChange(input);
      });
  }

  writeValue(obj?: DataSourceSetting): void {
    this.settings = obj ?? new DataSourceSetting();
    this.otherFields = [];
    if (obj && obj.params) {
      let item = this.collectionDataSource.find((x) => x.id == this.settings.id);
      if (item && item.inputData) {
        for (let f of item.inputData) {
          if (obj.params[f.name] != undefined) {
            f.value = obj.params[f.name];
          }
        }
        this.otherFields = item.inputData!;
      }
    }
  }

  ngOnInit() {}

  public get DynamicDataInputType(): typeof DynamicDataInputType {
    return DynamicDataInputType;
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }

  onChangeDataSource() {
    let item = this.collectionDataSource.find((x) => x.id == this.settings.id);
    if (!item) {
      this.otherFields = [];
      return;
    }
    if (item.inputData) {
      this.otherFields = item.inputData;
    } else {
      this.otherFields = [];
    }
  }

  update() {
    this.settingChange$.next(this.settings);
  }

  updt(item: DynamicDataInputParameter) {
    this.settings.params ??= {};
    this.settings.params[item.name] = item.value;
    this.update();
  }
}
