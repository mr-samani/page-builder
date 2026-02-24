import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { COMPONENT_DATA, ComponentDataContext, DataSourceSetting } from 'ngx-page-builder/core';
import { DataSourceSettingComponent } from '../../_data-source-setting/data-source-setting.component';

@Component({
  selector: 'app-collection-settings',
  templateUrl: './collection-settings.component.html',
  styleUrls: ['./collection-settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DataSourceSettingComponent],
})
export class CollectionSettingsComponent implements OnInit {
  settings: DataSourceSetting = new DataSourceSetting();

  private context = inject<ComponentDataContext<DataSourceSetting>>(COMPONENT_DATA);
  constructor() {
    this.settings = this.context.data || new DataSourceSetting();
  }

  ngOnInit() {}

  update() {
    this.context.onChange.next(this.settings);
  }
}
