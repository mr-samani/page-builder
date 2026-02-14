import { ChangeDetectionStrategy, Component, inject, Inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  COMPONENT_DATA,
  ComponentDataContext,
  DataSourceSetting,
  DynamicDataService,
  DynamicDataStructure,
} from 'ngx-page-builder/core';

@Component({
  selector: 'app-collection-settings',
  templateUrl: './collection-settings.component.html',
  styleUrls: ['./collection-settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
})
export class DataSourceSettingsComponent implements OnInit {
  settings: DataSourceSetting = {};

  collectionDataSource: DynamicDataStructure[] = [];
  private context = inject<ComponentDataContext<DataSourceSetting>>(COMPONENT_DATA);
  constructor(public dynamicDataService: DynamicDataService) {
    this.settings = this.context.data || new DataSourceSetting();
    this.collectionDataSource = this.dynamicDataService.dynamicData.filter(
      (x: DynamicDataStructure) => x.list
    );
  }

  ngOnInit() {}

  update() {
    this.context.onChange.next(this.settings);
  }
}
