import { DynamicElementService, PageItem } from 'ngx-page-builder/core';
import { PageBuilderService } from '../../services/page-builder.service';
import { TableSection, SelectedCellInfo, RangeSelectionInfo } from './model';
import { buildLogicalGrid, getLogicalColIndexForChild } from './table-utiles';
import { _td, _th } from './template';

export abstract class TableHelper {
  /**
   * add new \<TR>
   */
  static async addRow(pb: PageBuilderService, table: PageItem, section: TableSection, after = false, rowIndex: number) {
    const theadOrTbody = table.children?.find((x: PageItem) => x.tag === section);
    if (!theadOrTbody) return;
    // ensure rowIndex valid
    const safeRowIndex = Math.min(Math.max(0, rowIndex), Math.max(0, theadOrTbody.children.length - 1));
    const row = theadOrTbody.children[safeRowIndex].clone(theadOrTbody);

    for (let cell of row.children) {
      cell.children = [];
    }
    theadOrTbody.children?.splice(after ? safeRowIndex + 1 : safeRowIndex, 0, row);

    await pb.createBlockElement(true, row, theadOrTbody.el!, after ? safeRowIndex + 1 : safeRowIndex);
  }

  /**
   * delete selected \<TR>
   */
  static async deleteRow(
    pb: PageBuilderService,
    dynamicElementService: DynamicElementService,
    table: PageItem,
    section: TableSection,
    rowIndex: number,
  ) {
    const theadOrTbody = table.children?.find((x: PageItem) => x.tag === section);
    if (!theadOrTbody) return;
    if (section == 'tbody' && theadOrTbody.children.length <= 1) return; // keep at least one row in tbody

    if (rowIndex < 0 || rowIndex >= theadOrTbody.children.length) return;
    const row = theadOrTbody.children[rowIndex];
    await dynamicElementService.destroy(row);
    theadOrTbody.children.splice(rowIndex, 1);
    pb.deSelectBlock();
  }

  /**
   * add new Column
   */
  static async addColumn(table: PageItem, colIndex: number, after = false) {
    for (let inner of table.children) {
      for (let row of inner.children) {
        let td = inner.tag == 'thead' ? _th : _td;
        td = PageItem.fromJSON(td);
        td.parent = row;
        // safe insert index
        const insertIdx = Math.min(Math.max(0, colIndex), Math.max(0, row.children.length));
        row.children.splice(after ? insertIdx + 1 : insertIdx, 0, td as PageItem);
      }
    }
  }

  /**
   * Delete column at logical index
   */
  static async deleteColumn(
    table: PageItem,
    section: TableSection,
    childRowIdx: number,
    childColIdx: number,
    firstSelectedCell?: SelectedCellInfo,
  ) {
    const sectionBlock = table.children?.find((x: PageItem) => x.tag === section) as PageItem;
    if (!sectionBlock) return;

    let logicalColIndex = 0;
    if (firstSelectedCell) {
      logicalColIndex = getLogicalColIndexForChild(
        sectionBlock,
        firstSelectedCell.rowIndex,
        firstSelectedCell.colIndex,
      );
    } else {
      logicalColIndex = getLogicalColIndexForChild(
        sectionBlock,
        Math.max(0, childRowIdx - 1),
        Math.max(0, childColIdx),
      );
    }

    for (const inner of table.children) {
      for (let r = 0; r < (inner.children?.length ?? 0); r++) {
        const row = inner.children[r];
        if (!row) continue;

        let curr = 0;
        const newChildren: PageItem[] = [];

        for (let i = 0; i < (row.children?.length ?? 0); i++) {
          const cell = row.children[i] as PageItem;
          const colspan = Number(cell.options?.attributes?.['colspan'] ?? 1);
          const c1 = curr;
          const c2 = curr + colspan - 1;

          if (logicalColIndex < c1 || logicalColIndex > c2) {
            newChildren.push(cell);
          } else {
            if (colspan > 1) {
              const newSpan = colspan - 1;
              cell.options ??= {};
              cell.options.attributes ??= {};
              if (newSpan === 1) {
                delete cell.options.attributes['colspan'];
                if (Object.keys(cell.options.attributes).length === 0) {
                  delete cell.options.attributes;
                }
              } else {
                cell.options.attributes['colspan'] = String(newSpan);
              }
              newChildren.push(cell);
            } else {
              // colspan === 1 : حذف سلول
              // اگر rowspan>1 باشد، رفتار پیچیده است — اینجا فعلاً سلول حذف می‌شود و ممکن است در ردیف‌های پایین placeholder لازم باشد.
              // برای نگهداری ساختار جدول کامل‌تر، می‌توانیم در آینده placeholder اضافه کنیم.
              // const rowspan = Number(cell.options?.attributes?.['rowspan'] ?? 1);
              // if (rowspan > 1) { ... }
            }
          }

          curr = c2 + 1;
        }

        row.children = newChildren;
      }
    }
  }

  static async mergeCells(
    dynamicElementService: DynamicElementService,
    table: PageItem,
    rangeSelection: RangeSelectionInfo,
  ) {
    if (!rangeSelection) return;
    const { section, row1, row2, col1, col2 } = rangeSelection;

    const sectionBlock = table.children?.find((x: PageItem) => x.tag === section) as PageItem;
    if (!sectionBlock) return;

    // ساخت grid منطقی از ردیف‌های این section
    const rows = sectionBlock.children ?? [];
    const grid = buildLogicalGrid(rows);
    if (!grid || grid.length === 0) return;

    // bounds safety
    if (row1 < 0 || row2 >= grid.length || col1 < 0 || col2 >= (grid[0]?.length ?? 0) || row1 > row2 || col1 > col2) {
      return;
    }

    const height = row2 - row1 + 1;
    const width = col2 - col1 + 1;

    // masterGridCell: گرید نقطه بالا-چپ
    const masterInfo = grid[row1][col1];
    if (!masterInfo) return;

    // اگر اون نقطه covered باشه (یعنی کاربر روی جایی کلیک کرده که top-left نیست)
    // بهتره master واقعی (top-left) برای آن سلول را بیابیم
    let masterCell = masterInfo.cell;
    if (!masterInfo.isReal) {
      // پیدا کردن top-left آن cell در grid
      outerFind: for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          const g = grid[r][c];
          if (g && g.isReal && g.cell === masterCell) {
            // بازنویس row1/col1 به top-left واقعی
            // اما توجه: در حالت نرمال rangeSelection باید با logical index ساخته شده باشه، پس این فقط safety است
            // همچنین ممکن است نیاز باشد range را براساس top-left مجدداً بازنرمالایز کنیم — اما ما اینجا تنها master را اصلاح می‌کنیم
            // (فرض می‌کنیم کاربر رنج را طوری انتخاب کرده که master در گوشه بالا-چپ منطقی است)
            // اگر بخوایم می‌توانیم row1= r; col1 = c; ولی چون rangeSelection از قبل تولید شده بهتر است همان رنج را نگه داریم
            masterCell = g.cell;
            break outerFind;
          }
        }
      }
    }

    // تنظیم rowspan/colspan روی master cell (در مدل)
    masterCell.options ??= {};
    masterCell.options.attributes ??= {};
    if (height > 1) masterCell.options.attributes['rowspan'] = String(height);
    else delete masterCell.options.attributes?.['rowspan'];
    if (width > 1) masterCell.options.attributes['colspan'] = String(width);
    else delete masterCell.options.attributes?.['colspan'];

    // جمع‌آوری سلول‌های واقعی (top-left) در محدوده به جز master که باید حذف شوند
    const toRemoveByParent = new Map<PageItem, number[]>(); // parentRow -> [childIndex,...]
    const seen = new Set<PageItem>();

    for (let r = row1; r <= row2; r++) {
      for (let c = col1; c <= col2; c++) {
        const g = grid[r][c];
        if (!g) continue;
        // فقط سلول‌های واقعی (top-left) را حذف/در نظر می‌گیریم
        if (!g.isReal) continue;

        const cell = g.cell;
        if (cell === masterCell) continue; // skip master

        if (seen.has(cell)) continue; // یک سلول top-left ممکن است فقط در یک خانه isReal باشد ولی احتیاط
        seen.add(cell);

        const parentRow = cell.parent as PageItem;
        if (!parentRow) continue;
        const childIdx = parentRow.children.indexOf(cell);
        if (childIdx < 0) continue;

        if (!toRemoveByParent.has(parentRow)) toRemoveByParent.set(parentRow, []);
        toRemoveByParent.get(parentRow)!.push(childIdx);
      }
    }

    // حذف در هر ردیف: حذف از بزرگ به کوچک تا اندیس‌ها تغییر نکند
    toRemoveByParent.forEach(async (indices, parentRow) => {
      indices.sort((a, b) => b - a);
      for (const idx of indices) {
        // destroy element if exists
        const cell = parentRow.children[idx] as PageItem | undefined;
        if (cell) {
          try {
            await dynamicElementService.destroy(cell);
          } catch (err) {
            // ignore
          }
        }
        parentRow.children.splice(idx, 1);
      }
    });
  }

  static async unMergeCells(table: PageItem, firstSelectedCell: SelectedCellInfo) {
    try {
      if (!firstSelectedCell) return;

      const { section, rowIndex, colIndex } = firstSelectedCell;

      const sectionBlock = table.children?.find((x: PageItem) => x.tag === section) as PageItem;
      if (!sectionBlock) return;

      const rows = sectionBlock.children ?? [];
      // بازسازی grid کنونی (در این حالت master ممکنه rowspan/colspan داشته باشه)
      const grid = buildLogicalGrid(rows);

      // اطمینان از bounds
      if (!grid || rowIndex < 0 || rowIndex >= grid.length || colIndex < 0 || colIndex >= (grid[0]?.length ?? 0)) {
        return;
      }

      const masterInfo = grid[rowIndex][colIndex];
      if (!masterInfo || !masterInfo.isReal) {
        // اگر اینجا top-left نیست سعی کن top-left واقعی را پیدا کنی
        let found = false;
        for (let r = 0; r < grid.length && !found; r++) {
          for (let c = 0; c < (grid[r]?.length ?? 0) && !found; c++) {
            const g = grid[r][c];
            if (g && g.isReal && g.cell === masterInfo?.cell) {
              // بازنویسی اندیس‌ها
              // توجه: این حالت نادر است ولی safety می‌کنیم
              // (در صورتی که firstSelectedCell حاوی logical top-left باشد نباید اینجا بیاییم)
              // برای سادگی: return چون firstSelectedCell باید top-left واقعی باشد
              found = true;
            }
          }
        }
        if (!found) return;
      }

      const masterCell = masterInfo.cell;
      const rowspan = Number(masterCell.options?.attributes?.['rowspan'] ?? 1);
      const colspan = Number(masterCell.options?.attributes?.['colspan'] ?? 1);

      if (rowspan === 1 && colspan === 1) return;

      // remove rowspan/colspan attributes from master
      if (masterCell.options?.attributes) {
        delete masterCell.options.attributes['rowspan'];
        delete masterCell.options.attributes['colspan'];
        if (Object.keys(masterCell.options.attributes).length === 0) {
          delete masterCell.options.attributes;
        }
      }

      // پس از حذف attributeها، grid فعلی هنوز با master occupying چند خانه خواهد بود
      // پس برای تعیین اندیس درج در هر ردیف، دوباره grid را بسازیم (یا از grid موجود استفاده کنیم ولی باید map child->firstLogicalCol بسازیم)
      // از grid موجود استفاده می‌کنیم تا mapping از هر child به firstLogicalCol در آن ردیف استخراج کنیم

      // تابع helper محلی: تولید map از PageItem -> firstLogicalCol برای ردیف r
      const getFirstLogicalColMapForRow = (r: number) => {
        const map = new Map<PageItem, number>();
        if (!grid[r]) return map;
        for (let c = 0; c < grid[r].length; c++) {
          const g = grid[r][c];
          if (!g) continue;
          if (g.isReal) {
            if (!map.has(g.cell)) {
              map.set(g.cell, c);
            }
          }
        }
        return map;
      };

      // حالا در هر ردیف هدف سلول‌های جدید را اضافه می‌کنیم (به جز master)
      for (let r = rowIndex; r <= rowIndex + rowspan - 1; r++) {
        // اگر ردیف وجود ندارد (در موارد نادر) ایجادش نکن — ولی معمولا وجود دارد
        if (r < 0 || r >= rows.length) continue;
        const targetRow = rows[r];
        const firstColMap = getFirstLogicalColMapForRow(r);

        for (let c = colIndex; c <= colIndex + colspan - 1; c++) {
          if (r === rowIndex && c === colIndex) continue; // skip master

          // تعیین اندیس درج در targetRow.children براساس logical col c
          // پیدا کن اولین سلولی که firstLogicalCol >= c و سپس insert قبل از آن
          let insertBeforeChild: PageItem | undefined = undefined;
          for (const [child, firstCol] of firstColMap.entries()) {
            if (firstCol >= c) {
              // اگر چندتا بود، می‌خواهیم نزدیک‌ترین firstCol را بگیریم (کمترین firstCol >= c)
              if (!insertBeforeChild) insertBeforeChild = child;
              else {
                const prev = firstColMap.get(insertBeforeChild)!;
                if (firstCol < prev) insertBeforeChild = child;
              }
            }
          }

          const insertIdx =
            insertBeforeChild != null
              ? Math.max(0, targetRow.children.indexOf(insertBeforeChild))
              : targetRow.children.length;

          // ساخت cell جدید و درج
          const template = section === 'thead' ? _th : _td;
          const newCell = PageItem.fromJSON(template) as PageItem;
          newCell.parent = targetRow;
          newCell.children = [];

          // splice at insertIdx
          targetRow.children.splice(insertIdx, 0, newCell);
        }
      }
    } catch (err) {
      console.error('unMergeCells error:', err);
    }
  }
}
