import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import {
  NGX_PAGE_BUILDER_EXPORT_PLUGIN_STORE,
  providePageBuilder,
  StorageType,
} from '@ngx-page-builder';
import { CustomSources } from './custom-source/custom-sources';
import { provideHighcharts } from 'highcharts-angular';
import { PluginService } from './builder/plugin.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    providePageBuilder({
      customSources: CustomSources,
      storageType: StorageType.LocalStorage,
      enableExportAsPlugin: true,
      showPlugins: true,
      publicCss: ['/bootstrap.min.css'],
      publicJs: ['/bootstrap.min.js'],
    }),
    {
      provide: NGX_PAGE_BUILDER_EXPORT_PLUGIN_STORE,
      useExisting: PluginService,
    },
    // {
    //   provide: NGX_PAGE_BUILDER_STORAGE_SERVICE,
    //   useClass: MessagePackStorageService,
    // },
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
