import { Subject } from 'rxjs/internal/Subject';

export interface ComponentDataContext<T = any> {
  /**
   * additional data
   */
  data: T;
  /**
   * set changed data for save in pagebuilder
   */
  onChange: Subject<T>;
}
