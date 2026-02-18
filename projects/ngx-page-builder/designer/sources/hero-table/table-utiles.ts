import { PageItem } from 'ngx-page-builder/core';

export interface LogicalGridCell {
  cell: PageItem;
  isReal: boolean; // این نقطه، خودِ سلول واقعی است (top-left)
  isCovered: boolean; // زیر یک سلول با span قرار گرفته
}
/**
 * Create rectangle from two coordinates
 */
export function getNormalizedRange(a: { row: number; col: number }, b: { row: number; col: number }) {
  return {
    row1: Math.min(a.row, b.row),
    row2: Math.max(a.row, b.row),
    col1: Math.min(a.col, b.col),
    col2: Math.max(a.col, b.col),
  };
}

export function buildLogicalGrid(rows: PageItem[]): LogicalGridCell[][] {
  const grid: LogicalGridCell[][] = [];

  rows.forEach((row, rIndex) => {
    if (!grid[rIndex]) grid[rIndex] = [];

    let colPointer = 0;

    for (const cell of row.children) {
      const colspan = Number(cell.options?.attributes?.['colspan'] ?? 1);
      const rowspan = Number(cell.options?.attributes?.['rowspan'] ?? 1);

      // colPointer را روی اولین خانه خالی می‌بریم
      while (grid[rIndex][colPointer]) colPointer++;

      // پر کردن کل محدوده span
      for (let rr = 0; rr < rowspan; rr++) {
        for (let cc = 0; cc < colspan; cc++) {
          const r = rIndex + rr;
          const c = colPointer + cc;

          if (!grid[r]) grid[r] = [];

          grid[r][c] = {
            cell,
            isReal: rr === 0 && cc === 0, // فقط نقطه top-left واقعی است
            isCovered: !(rr === 0 && cc === 0), // بقیه نقاط covered هستند
          };
        }
      }

      colPointer += colspan;
    }
  });

  return grid;
}
/**
 * Checks if a candidate range (row1..row2, col1..col2) is valid to merge
 *
 * Conditions:
 *  - All rows exist
 *  - For each cell covered by the rectangle: the cell must exist and must have rowspan==1 and colspan==1
 *  - Height x Width must be > 1 (1x1 is not merge)
 *
 * Note: This helper assumes "rowChildren" is the array of PageItem rows for a single section (thead/tbody/tfoot).
 */
export function isValidMergeRange(
  rows: PageItem[],
  range: { row1: number; row2: number; col1: number; col2: number },
): boolean {
  if (!rows || rows.length === 0) return false;

  const grid = buildLogicalGrid(rows);
  const totalRows = grid.length;
  const totalCols = grid[0]?.length ?? 0;

  // Check bounds
  if (
    range.row1 < 0 ||
    range.row2 >= totalRows ||
    range.col1 < 0 ||
    range.col2 >= totalCols ||
    range.row1 > range.row2 ||
    range.col1 > range.col2
  ) {
    return false;
  }

  const height = range.row2 - range.row1 + 1;
  const width = range.col2 - range.col1 + 1;

  // 1x1 is not merge
  if (height === 1 && width === 1) return false;

  // Set to check all real cells inside range
  const seen = new Set<PageItem>();

  for (let r = range.row1; r <= range.row2; r++) {
    for (let c = range.col1; c <= range.col2; c++) {
      const g = grid[r][c];
      if (!g) return false;

      // ⛔ اگر covered باشد → یعنی در span سلول دیگری است → invalid
      if (g.isCovered) return false;

      const cell = g.cell;
      const rowspan = Number(cell.options?.attributes?.['rowspan'] ?? 1);
      const colspan = Number(cell.options?.attributes?.['colspan'] ?? 1);

      // ⛔ سلول‌هایی که قبلاً merged هستند نمی‌توانند دوباره merge شوند
      if (rowspan > 1 || colspan > 1) return false;

      seen.add(cell);
    }
  }

  // تعداد سلول‌های یکتا باید برابر تعداد نقاط منطقی باشد
  if (seen.size !== height * width) return false;

  return true;
}

export function findCellLogicalIndex(rows: PageItem[], cell: PageItem): { rowIndex: number; colIndex: number } {
  const grid = buildLogicalGrid(rows);

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const g = grid[r][c];
      if (g && g.isReal && g.cell === cell) {
        return { rowIndex: r, colIndex: c };
      }
    }
  }

  throw new Error('Cell not found in logical grid');
}

// helper: محاسبه logical column index برای یک child index در یک row
export function getLogicalColIndexForChild(sectionBlock: PageItem, rowIndex: number, childIndex: number): number {
  const row = sectionBlock.children?.[rowIndex];
  if (!row) return 0;
  let curr = 0;
  for (let i = 0; i < row.children.length; i++) {
    if (i === childIndex) return curr;
    const span = Number(row.children[i].options?.attributes?.['colspan'] ?? 1);
    curr += span;
  }
  // اگر childIndex خارج از محدوده بود، بازگردان curr (معمولاً آخرین)
  return curr;
}
// helper: تعداد ستون‌های منطقی فعلی در section (بر پایه اولین ردیف)
export function getLogicalColumnCount(sectionBlock: PageItem): number {
  if (!sectionBlock || !sectionBlock.children || sectionBlock.children.length === 0) return 0;
  // محاسبه از روی ردیف اول (فرض کردن جدول مستطیلی)
  const firstRow = sectionBlock.children[0];
  let total = 0;
  for (const cell of firstRow.children) {
    total += Number(cell.options?.attributes?.['colspan'] ?? 1);
  }
  return total;
}
