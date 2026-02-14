import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import {
  NGX_PAGE_BUILDER_EXPORT_PLUGIN_STORE,
  NGX_PAGE_BUILDER_STORAGE_SERVICE,
} from 'ngx-page-builder/designer';
import { provideHighcharts } from 'highcharts-angular';
import { PluginService } from './builder/plugin.service';
import { MessagePackStorageService } from './custom-storage/msgpack.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    {
      provide: NGX_PAGE_BUILDER_EXPORT_PLUGIN_STORE,
      useExisting: PluginService,
    },
    {
      provide: NGX_PAGE_BUILDER_STORAGE_SERVICE,
      useClass: MessagePackStorageService,
    },
    provideHighcharts({
      // Optional: Define the Highcharts instance dynamically
      instance: () => import('highcharts'),

      // Global chart options applied across all charts
      options: {
        title: {
          style: {
            color: 'tomato',
          },
        },
        legend: {
          enabled: false,
        },
      },

      // Include Highcharts additional modules (e.g., exporting, accessibility) or custom themes
      modules: () => {
        return [import('highcharts/esm/modules/exporting')];
      },
    }),
  ],
};
