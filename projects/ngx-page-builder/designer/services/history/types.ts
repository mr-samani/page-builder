export type HistoryValue = null | boolean | number | string | HistoryValue[] | { [key: string]: HistoryValue };
export type PropertyState = { exists: false } | { exists: true; value: HistoryValue };
export interface HistoryPosition {
  parentId: string | null;
  index: number;
}
export interface HistorySubtree {
  id: string;
  properties: { [key: string]: HistoryValue };
  children: HistorySubtree[];
}
export type HistoryOperation =
  | { type: 'set'; id: string; path: string[]; before: PropertyState; after: PropertyState }
  | { type: 'insert' | 'remove'; position: HistoryPosition; node: HistorySubtree }
  | { type: 'move'; id: string; from: HistoryPosition; to: HistoryPosition };
export interface HistoryOptions {
  description?: string;
  groupKey?: string;
}
export interface HistoryChange {
  direction: 'record' | 'undo' | 'redo';
  operations: readonly HistoryOperation[];
}
/** Apply ALL operations synchronously or throw without changing the document. */
export type HistoryApply = (operations: readonly HistoryOperation[]) => undefined;
export interface Entry {
  json: string;
  description?: string;
  bytes: number;
  timestamp: number;
}
export interface Timeline {
  entries: readonly Entry[];
  index: number;
  bytes: number;
}
