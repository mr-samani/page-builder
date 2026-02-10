import { Component, Injector, OnInit } from '@angular/core';
import { BaseComponent } from '../BaseComponent';
import { BlockPropertiesComponent } from '../block-properties/block-properties.component';
import { BlockLayoutsComponent } from '../block-layouts/block-layouts.component';
import { BlockSettingsComponent } from '../block-settings/block-settings.component';
import { SvgIconDirective } from '../../directives/svg-icon.directive';

@Component({
  selector: 'side-config',
  templateUrl: './side-config.component.html',
  styleUrls: ['./side-config.component.scss'],
  standalone: true,
  imports: [
    BlockPropertiesComponent,
    BlockLayoutsComponent,
    BlockSettingsComponent,
    SvgIconDirective,
  ],
})
export class SideConfigComponent extends BaseComponent implements OnInit {
  selectedTab: 'layouts' | 'properties' | 'settings' = 'properties';
  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit() {}
}
