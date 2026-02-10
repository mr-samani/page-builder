import { ViewMode, ViewModes } from './ViewMode';

export function validateViewMode(mode: ViewMode): ViewMode {
  return ViewModes.includes(mode) ? mode : 'PrintPage';
}
