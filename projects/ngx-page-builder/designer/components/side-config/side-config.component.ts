import { Component, Injector, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { BaseComponent } from '../BaseComponent';
import { BlockPropertiesComponent } from '../block-properties/block-properties.component';
import { BlockSettingsComponent } from '../block-settings/block-settings.component';
import { NgxIconComponent } from 'ngx-page-builder/icons';

@Component({
  selector: 'side-config',
  templateUrl: './side-config.component.html',
  styleUrls: ['./side-config.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BlockPropertiesComponent, BlockSettingsComponent, NgxIconComponent],
})
export class SideConfigComponent extends BaseComponent implements OnInit {
  selectedTab: 'properties' | 'settings' = 'properties';
  constructor() {
    super();
  }

  ngOnInit() {}
}
