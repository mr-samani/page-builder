/**
 * Snippet: a saved, reusable block (with all of its children and styles).
 * Adding a snippet to a page inserts an independent copy of it.
 */
export interface ISnippet {
  name: string;
  /** serialized block tree + its manual class styles (opaque to stores; save and return it as-is) */
  data: string;
  /** screenshot (data-url) */
  image: string;
  loading?: boolean;
}

export interface IPaginationSnippet {
  items: ISnippet[];
  total: number;
}
