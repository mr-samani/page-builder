import type { DataMode, PaginationMode, SortSpec } from '../data/types';

/**
 * How a block (collection, table, record wrapper) gets its data.
 * Every property except `id` is optional, so JSON saved by older versions still loads unchanged.
 */
export class DataSourceSetting<InputData = { [key: string]: any }> {
  /** the data source (registered in the DataStore / known by the backend). Empty = the block is not connected. */
  id!: string;

  /**
   * `list` (default) repeats the template per record.
   * `single` shows ONE record (details pages): the block does not repeat, its descendants bind to that record.
   */
  mode?: DataMode;

  /** first record (offset) */
  skipCount?: number;
  /** page size (`take`) */
  maxResultCount?: number;

  /**
   * @deprecated legacy single-field binding of a block INSIDE a collection.
   * Use `ItemBinding` (`item.binding`), which can bind text, attributes, classes, visibility and format values.
   * It keeps working: it is converted to the new form when the page is rendered.
   */
  binding?: string;

  /**
   * Filters sent to the data source. Values may be literals or references resolved per page / per record:
   *   '@route.slug'  '@query.category'  '@parent.id'  '@global.tenantId'  'cat-{{route.slug}}'
   */
  params?: InputData;

  /** full-text search; usually a reference such as '@query.q' */
  search?: string;

  sort?: SortSpec[];
  /**
   * Let visitors sort through the URL: `?sort=price:desc`. The field must be sortable in the source schema.
   * (the value of the setting is the query parameter name)
   */
  sortParam?: string;

  pagination?: {
    mode: PaginationMode;
    /** query parameter holding the page number for `pager` (default `page`) */
    pageParam?: string;
  };

  /** record field used to recognise rows between updates (default `id`) — keeps DOM and scroll position stable */
  keyField?: string;

  /** ask the server for the fields the template uses only (default true) */
  projectFields?: boolean;

  /** skeleton rows shown while loading (default 0 = nothing) */
  loadingCount?: number;
  emptyText?: string;
  errorText?: string;
  /** shown when a `single` record does not exist */
  notFoundText?: string;
  /** hide the whole block when there is nothing to show */
  hideWhenEmpty?: boolean;
}
