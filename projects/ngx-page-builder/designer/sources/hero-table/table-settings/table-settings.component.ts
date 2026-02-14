import { ChangeDetectionStrategy, Component, inject, Inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableSetting } from '../table-setting';
import { SwitchComponent } from '../../../controls/switch/switch.component';

import {
  COMPONENT_DATA,
  ComponentDataContext,
  DynamicDataService,
  DynamicDataStructure,
} from 'ngx-page-builder/core';

@Component({
  selector: 'app-table-settings',
  templateUrl: './table-settings.component.html',
  styleUrls: ['./table-settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SwitchComponent],
})
export class HeroTableSettingsComponent implements OnInit {
  settings: TableSetting = {};

  collectionDataSource: DynamicDataStructure[] = [];
  private context = inject<ComponentDataContext<TableSetting>>(COMPONENT_DATA);
  constructor(public dynamicDataService: DynamicDataService) {
    this.settings = this.context.data || new TableSetting();
    this.collectionDataSource = this.dynamicDataService.dynamicData.filter(
      (x: DynamicDataStructure) => x.list
    );
  }

  ngOnInit() {}

  update() {
    this.context.onChange.next(this.settings);
  }
}
