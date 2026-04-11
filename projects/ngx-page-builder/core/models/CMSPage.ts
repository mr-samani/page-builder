export interface CMSPage {
  slag: string;
  title: string;
  queryString?: CMSPageQueryString[];
}

export interface CMSPageQueryString {
  key: string;
  value: string;
  isDynamic?: boolean;
  /** this field filled on render app with value of dynamic data
   * - in collection-item sourceF
   */
  dynamicValue?: string;
}
