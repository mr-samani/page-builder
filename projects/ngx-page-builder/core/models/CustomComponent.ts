import { DestroyableInjector, Provider, Type } from '@angular/core';

export class CustomComponent {
  /**
   * Component key
   * -unique name of component
   */
  componentKey!: string;
  /**
   * Custom Component reference
   * - lazy loaded component
   * @example ()=> import(./chart/chart.component).then(c=>c.MyChartComponent)
   */
  component!: () => Promise<Type<any>>;

  /**
   * Custom component settings reference
   * - lazy loaded component settings
   * @example ()=> import(./chart/settings/chart-settings.component).then(c=>c.MyChartSettingsComponent)
   */
  componentSettings?: () => Promise<Type<any>>;

  /**
   * Providers for the custom component
   * - shared service between CustomComponent and CustomComponentSettings
   */
  providers?: Provider[];

  /**
   * custom component injection providers
   * @readonly
   * @description this property would be set by library
   */
  compInjector?: DestroyableInjector;
  /**
   * storage for component additional data
   */
  componentData?: any;
}
