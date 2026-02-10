import { PageItem } from "ngx-page-builder/core";

export interface ImportResult {
  success: boolean;
  data?: PageItem[];
  error?: string;
  warnings?: string[];
}
