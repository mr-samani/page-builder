import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableSetting } from '../table-setting';
import { SwitchComponent } from '../../../controls/switch/switch.component';
import { DataSourceSettingComponent } from '../../_data-source-setting/data-source-setting.component';
import { COMPONENT_DATA, ComponentDataContext } from 'ngx-page-builder/core';

@Component({
  selector: 'app-table-settings',
  templateUrl: './table-settings.component.html',
  styleUrls: ['./table-settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SwitchComponent, DataSourceSettingComponent],
})
export class HeroTableSettingsComponent implements OnInit {
  settings: TableSetting = new TableSetting();

  private context = inject<ComponentDataContext<TableSetting>>(COMPONENT_DATA);
  constructor() {
    this.settings = this.context.data || new TableSetting();
  }

  ngOnInit() {}

  update() {
    this.context.onChange.next(this.settings);
  }
}
