import { PageItem } from '../models/PageItem';
import { IPageItem } from '../contracts/IPageItem';
import { DEFAULT_IMAGE_URL } from '../consts/defaults';
import { cloneDeep } from './clone-deep';
import { escapeHtml, getByPath, hasBindingToken, interpolateBindings, toDisplayText, toImageSrc } from './data-binding';

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

/**
 * The collection that contains a block (nearest ancestor that has a data source), or undefined when the block is
 * not used inside a list. Blocks inside a collection are bound to the fields of that collection.
 */
export function findParentCollection(item: PageItem | undefined | null): PageItem | undefined {
  for (let current = item?.parent; current; current = current.parent) {
    if (current.dataSource?.id) return current;
  }
  return undefined;
}

/**
 * Creates one repeated item of a collection from its template and fills the bound elements with the record values.
 * The template is NOT modified.
 * @param dataList records of the collection
 * @param template the item template
 * @param index record index
 */
export function cloneTemplate(dataList: any[], template: PageItem, index: number) {
  const row = dataList[index];

  const build = (item: PageItem): IPageItem => {
    const { parent, el, children, template: _t, options, ...rest } = item;
    const plain = { ...rest, children: [] as IPageItem[] } as IPageItem;
    if (options) {
      plain.options = cloneDeep(options);
      delete plain.options.events;
      delete plain.options.directives;
      delete plain.options.inputs;
      delete plain.options.outputs;
    }

    if (row) {
      fillFromRow(plain, item, row);
    }

    plain.children = (item.children ?? []).map(build);
    return plain;
  };

  const root = build(template);
  // children get their parent from the constructor, the root must keep the collection as parent
  root.parent = template.parent;
  return PageItem.fromJSON(root);
}

/** puts the values of one record into the content / attributes of a copy of a template block */
function fillFromRow(plain: IPageItem, item: PageItem, row: unknown) {
  const binding = item.dataSource?.binding;

  if (binding) {
    const value = getByPath(row, binding);
    if (PageItem.isImage(item)) {
      plain.options ??= {};
      plain.options.attributes ??= {};
      plain.options.attributes['src'] = toImageSrc(value) || DEFAULT_IMAGE_URL;
    } else {
      plain.content = escapeHtml(toDisplayText(value));
    }
  } else if (hasBindingToken(item.content)) {
    // text with several fields written by hand: `{{title}} - {{price}}`
    plain.content = interpolateBindings(item.content!, (path) => getByPath(row, path), { escape: true });
  }

  // dynamic query strings of links: ?id={field}
  const queryString = plain.options?.customData?.['queryString'];
  if (Array.isArray(queryString)) {
    plain.options!.customData!['queryString'] = queryString.map((q: any) =>
      q.isDynamic ? { ...q, dynamicValue: toDisplayText(getByPath(row, q.value)) } : q,
    );
  }
}
