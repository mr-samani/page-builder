import { PageItem } from '../models/PageItem';
import { IPageItem } from '../contracts/IPageItem';
import { ISourceOptions } from '../models/SourceItem';
import { CustomComponent } from '../models/CustomComponent';
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

//-------------------------------------------------------------------------------------------------------------------
// Template / clone helpers
//
// IMPORTANT (performance): a PageItem is a node of a big object graph (parent -> whole page, el -> DOM element ->
// Angular ComponentRef/LView -> application, options.directives[].inputs.pageItem -> parent ...).
// NEVER run cloneDeep() on a PageItem or on `options` of a PageItem that was rendered in the designer: it walks the
// whole graph (seconds per call). Everything below copies only the data fields of a block.
//-------------------------------------------------------------------------------------------------------------------

/** IPageItem + the runtime fields of PageItem that the constructor of PageItem copies */
type PlainItem = IPageItem & { customComponent?: CustomComponent };

interface PlainOptions {
  /** record of the repeated item; undefined when a template snapshot is made */
  row?: unknown;
  /** component inputs / outputs are data of a block, but rows never needed them (kept as before) */
  keepComponentIO: boolean;
  /** previous template blocks by id: used to keep the binding tokens of a template (see snapshotTemplate) */
  prevById?: Map<string, PageItem>;
  /** copy customComponent instead of sharing it (template snapshots must not share runtime state) */
  detachComponent?: boolean;
}

/** data only copy of the options of a block: events / directives are runtime (rebuilt by the designer) and never copied */
function copyOptions(options: ISourceOptions | undefined, keepComponentIO: boolean): ISourceOptions | undefined {
  if (!options) return undefined;
  const copy: ISourceOptions = {};
  if (options.attributes) copy.attributes = { ...options.attributes };
  if (options.customData !== undefined) copy.customData = cloneDeep(options.customData);
  if (keepComponentIO) {
    if (options.inputs) copy.inputs = cloneDeep(options.inputs);
    if (options.outputs) copy.outputs = { ...options.outputs };
  }
  return copy;
}

function indexById(root: PageItem, map = new Map<string, PageItem>()): Map<string, PageItem> {
  map.set(root.id, root);
  for (const child of root.children ?? []) indexById(child, map);
  return map;
}

/** plain (data only) copy of a block tree; `parent`, `el`, `template` and runtime options are not copied */
function toPlain(item: PageItem, o: PlainOptions): PlainItem {
  const { parent, el, children, template, options, classList, customComponent, ...rest } = item;
  const plain = { ...rest, classList: [...(classList ?? [])], children: [] as PlainItem[] } as PlainItem;

  plain.options = copyOptions(options, o.keepComponentIO);
  if (customComponent) {
    plain.customComponent = o.detachComponent
      ? { ...customComponent, compInjector: undefined, componentData: cloneDeep(customComponent.componentData) }
      : customComponent;
  }

  if (o.row !== undefined && o.prevById === undefined) {
    // a repeated item: bound blocks show the values of the record
    fillFromRow(plain, item, o.row);
  } else if (o.prevById) {
    keepTemplateBindings(plain, item, o.prevById.get(item.id), o.row);
  }

  plain.children = (children ?? []).map((child) => toPlain(child, o));
  return plain;
}

/**
 * A template snapshot is made from a repeated item that shows the values of ONE record. The parts that are derived
 * from the record (bound text / image, text with `{{tokens}}`) must not be written to the template:
 * the previous template value is kept unless the user really changed it.
 */
function keepTemplateBindings(plain: PlainItem, item: PageItem, prev: PageItem | undefined, row: unknown) {
  if (!prev) return;
  if (item.dataSource?.binding) {
    plain.content = prev.content;
    if (PageItem.isImage(item) && plain.options?.attributes && prev.options?.attributes?.['src'] !== undefined) {
      plain.options.attributes['src'] = prev.options.attributes['src'];
    }
  } else if (row !== undefined && hasBindingToken(prev.content)) {
    const derived = interpolateBindings(prev.content!, (path) => getByPath(row, path), { escape: true });
    if (item.content === derived) plain.content = prev.content;
  }
}

/**
 * Lightweight copy of a block tree to use as the template of a collection.
 * Replaces `cloneDeep(found.root)` (which copied the DOM, Angular internals and the whole page: seconds).
 * Styles (`css`) are shared by reference on purpose: all repeated items must see the same style object.
 * @param root the repeated item that was changed (it shows the values of ONE record)
 * @param prev the current template (keeps the binding tokens, see keepTemplateBindings)
 * @param row the record that `root` shows
 */
export function snapshotTemplate(root: PageItem, prev?: PageItem, row?: unknown): PageItem {
  const plain = toPlain(root, {
    keepComponentIO: true,
    detachComponent: true,
    prevById: prev ? indexById(prev) : new Map(),
    row,
  });
  const template = PageItem.fromJSON(plain);
  template.parent = root.parent;
  return template;
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
  const plain = toPlain(template, { keepComponentIO: false, row: row ?? undefined });
  const root = PageItem.fromJSON(plain);
  // children get their parent from the constructor, the root must keep the collection as parent
  root.parent = template.parent;
  return root;
}

/** puts the values of one record into the content / attributes of a copy of a template block */
function fillFromRow(plain: PlainItem, item: PageItem, row: unknown) {
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

/**
 * Structural comparison of plain data (settings, attributes, ...).
 * Unlike isEqual() the class of an object does not matter (settings loaded from json are plain objects, new ones are
 * class instances) and a property that is `undefined` is the same as a missing property.
 */
export function isSameData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  const aEmpty = a === undefined || a === null;
  const bEmpty = b === undefined || b === null;
  if (aEmpty || bEmpty) return aEmpty && bEmpty;
  if (typeof a !== 'object' || typeof b !== 'object') return Number.isNaN(a) && Number.isNaN(b);

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, i) => isSameData(value, b[i]));
  }

  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const key of keys) {
    if (!isSameData(ao[key], bo[key])) return false;
  }
  return true;
}

/** query strings without the values that come from the record (those differ in every repeated item) */
function stableCustomData(customData: any): any {
  const q = customData?.queryString;
  if (!Array.isArray(q)) return customData;
  return { ...customData, queryString: q.map((x: any) => (x?.isDynamic ? { ...x, dynamicValue: undefined } : x)) };
}

/**
 * true when two templates produce exactly the same repeated items (styles are not compared: they live in the
 * stylesheet and are shared by all copies, a style change needs no re-rendering).
 */
export function isSameTemplate(a: PageItem, b: PageItem): boolean {
  if (a === b) return true;
  if (a.id !== b.id || a.tag !== b.tag || !!a.canHaveChild !== !!b.canHaveChild) return false;

  const ac = a.classList ?? [];
  const bc = b.classList ?? [];
  if (ac.length !== bc.length || ac.some((c, i) => c !== bc[i])) return false;

  if (!a.dataSource?.binding && (a.content ?? '') !== (b.content ?? '')) return false;
  if (!isSameData(a.dataSource, b.dataSource)) return false;
  if (!isSameData(a.options?.attributes, b.options?.attributes)) {
    // the src of a bound image is derived from the record
    if (!a.dataSource?.binding) return false;
  }
  if (!isSameData(stableCustomData(a.options?.customData), stableCustomData(b.options?.customData))) {
    return false;
  }

  const ak = a.customComponent;
  const bk = b.customComponent;
  if (!!ak !== !!bk) return false;
  if (ak && bk && (ak.componentKey !== bk.componentKey || !isSameData(ak.componentData, bk.componentData))) {
    return false;
  }

  const an = a.children ?? [];
  const bn = b.children ?? [];
  if (an.length !== bn.length) return false;
  for (let i = 0; i < an.length; i++) if (!isSameTemplate(an[i], bn[i])) return false;
  return true;
}

/**
 * Makes every block of `target` use the style object of the same block of `template`.
 * (one style object is shared by all repeated items: editing one of them edits all of them)
 * Only walks trees with the same shape; returns without doing anything on the first difference.
 */
export function shareTemplateCss(target: PageItem, template: PageItem): void {
  if (target.id !== template.id) return;
  if (target.css !== template.css) target.css = template.css;
  const tc = target.children ?? [];
  const sc = template.children ?? [];
  const n = Math.min(tc.length, sc.length);
  for (let i = 0; i < n; i++) shareTemplateCss(tc[i], sc[i]);
}
