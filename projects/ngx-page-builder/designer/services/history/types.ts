export type ActionType = 'set' | 'insert' | 'remove' | 'move';
export class HistoryOperation<T> {
  type!: ActionType;
  tag!: string;
  id!: string;

  /** block before edit  */
  before?: T;
  /** block after edit */
  after?: T;
  index?: number;
  node!: T;

  // move
  fromIndex?: number;
  toIndex?: number;
}
export interface HistoryOptions {
  description?: string;
  groupKey?: string;
}
export interface HistoryChange<T> {
  direction: 'record' | 'undo' | 'redo';
  operation: HistoryOperation<T>;
}
export interface Entry {
  json: string;
  description?: string;
  bytes: number;
  timestamp: number;
  type?: ActionType;
  tag?: string;
}
export interface Timeline {
  entries: readonly Entry[];
  index: number;
  bytes: number;
}
