import { Component, computed, Inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChartService } from '../chart.service';
import { COMPONENT_DATA, ComponentDataContext } from 'ngx-page-builder/core';
import { IChartConfig } from '../chart-config.interface';

@Component({
  selector: 'app-chart-setting',
  templateUrl: './chart-setting.component.html',
  styleUrls: ['./chart-setting.component.css'],
  imports: [FormsModule],
})
export class ChartSettingComponent implements OnInit {
  constructor(
    @Inject(COMPONENT_DATA) private context: ComponentDataContext<IChartConfig>,

    public chartService: ChartService
  ) {}

  ngOnInit() {}
  update() {
    // store config in pagebuilder
    this.context.onChange.next(this.chartService.myConfig);
    this.chartService.initializeChart();
  }
}
