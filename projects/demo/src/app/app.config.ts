import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHighcharts } from 'highcharts-angular';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideNotify } from 'ngx-kit/notify';
import { provideNgxDialog } from 'ngx-kit/dialog';
import { provideMessage } from 'ngx-kit/message';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withXhr()),
    provideNotify(),
    provideMessage(),
    provideNgxDialog({ header: { showMaximizeButton: false } }),
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
