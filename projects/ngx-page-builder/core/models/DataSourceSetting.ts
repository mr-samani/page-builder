export class DataSourceSetting {
  id?: string;
  skipCount?: number;
  maxResultCount?: number;
  /**
   * The column to which the data source is bound
   */
  binding?: string;
}
