import { DynamicDataStructure } from '../models/DynamicData';
import { PageItem } from '../models/PageItem';

/**
 * بررسی می‌کند آیا یک آیتم در بین فرزندان یک تمپلیت خاص وجود دارد یا خیر
 * @param item ایتمی که به فرم اضاف شده است
 * @param templateChildren فرزندان تکرار بذیر
 * @returns boolean
 */
export function itemInThisTemplate(
  item: PageItem | null,
  templateChildren: PageItem[],
): { result: boolean; root?: PageItem } {
  if (!item || !templateChildren || !templateChildren.length) {
    return { result: false };
  }
  // پیدا کردن ریشه یک المان
  let p = findCellContainer(item);
  if (!p) return { result: false };
  // اگر المان ریشه جز فرزندان همین کالکشن بود
  for (let t of templateChildren) {
    if (t.id == p.id) {
      return { result: true, root: p };
    }
  }
  return { result: false };
}

/**
 * پیدا کردن ریشه یک المان در تمپلیت کالکشن
 * - به عنوان مثال در لیست کالا ها اگر المان قیمت به این متد ارسال شود باید المان ریشه تملیت که تکرار پذیر است را پیدا کند
 * @param item
 * @returns
 */
export function findCellContainer(item: PageItem): PageItem | undefined {
  if (item.isTemplateContainer) {
    return item;
  }
  if (item.parent) {
    return findCellContainer(item.parent);
  }
  return undefined;
}

export function cloneTemplate(
  dataList: DynamicDataStructure[][],
  template: PageItem,
  index: number,
) {
  const cleanTree = (item: PageItem) => {
    delete item.options?.events;
    delete item.options?.directives;
    delete item.options?.inputs;
    delete item.options?.outputs;
    if (item.dataSource && item.dataSource.binding) {
      const row = dataList[index];
      if (row) {
        const col = row.find((x: DynamicDataStructure) => x.name == item.dataSource!.binding);
        const isImage = PageItem.isImage(item);
        if (isImage) {
          item.options ??= {};
          item.options.attributes ??= {};
          item.options.attributes['src'] = (col?.value ?? '').toString();
        } else {
          item.content = (col?.value ?? '').toString();
        }
      }
      // console.log(index + '=>', item.content);
    }
    if (item.children && item.children.length > 0) {
      item.children.map((child) => cleanTree(child));
    }
    return item;
  };
  //  console.time('cleanTree');
  //const t = cleanTree(cloneDeep(this.pageItem.template!));
  const t = cleanTree(template!);
  // console.timeEnd('cleanTree');
  // cleanTree([cloneDeep(this.pageItem.template!)]);
  return PageItem.fromJSON(t);
}
