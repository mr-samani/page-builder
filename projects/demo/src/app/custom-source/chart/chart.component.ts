import { Component, inject, computed } from '@angular/core';
import { HighchartsChartComponent } from 'highcharts-angular';
import { ChartService } from './chart.service';
import { COMPONENT_DATA, ComponentDataContext } from 'ngx-page-builder/core';
import { IChartConfig } from './chart-config.interface';

@Component({
  selector: 'signal-highcart',
  templateUrl: './chart.component.html',
  standalone: true,
  imports: [HighchartsChartComponent],
  providers: [],
  styles: `
    :host {
      display: block;
    }
  `,
})
export class SignalHighChartComponent {
  updateChart = computed(() => this.chartService.initializeChart());

  private readonly context: ComponentDataContext<IChartConfig> = inject(COMPONENT_DATA);

  constructor(public chartService: ChartService) {
    // get saved data from pagebuilder
    if (this.context.data) this.chartService.myConfig = this.context.data;
  }

  ngOnInit() {
    this.updateChart();
  }
  onLoad(ev: Highcharts.Chart) {
    this.chartService.chart = ev;
  }

  updateData() {
    this.chartService.data.update((prev) => [...prev, Math.random() * 100]);
    this.updateChart();
  }
}
