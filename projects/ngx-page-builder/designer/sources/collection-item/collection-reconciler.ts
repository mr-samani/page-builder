import {
  PageItem,
  cloneTemplate,
  isSameData,
  isSameTemplate,
  shareTemplateCss,
  snapshotTemplate,
} from 'ngx-page-builder/core';

/**
 * What the reconciler needs from the page builder. Everything DOM / Angular specific is behind this interface
 * (so the algorithm can be tested without Angular).
 */
export interface ReconcileEnv {
  /** renders `item` (and its children) as child number `index` of `container`; index -1 appends */
  createBlock(item: PageItem, container: HTMLElement, index: number): Promise<unknown>;
  /** destroys the element / component / directives of `item` and of all its children and removes the element */
  destroyBlock(item: PageItem): Promise<unknown>;
  /** updates the rendered `item` in place from `next`; false (and nothing changed) when it is not possible */
  patchBlock(item: PageItem, next: PageItem): boolean;
  /** true when the work must stop (component destroyed) */
  isCancelled(): boolean;
}

export interface ReconcileRowsOptions {
  /** the collection block */
  owner: PageItem;
  /** element of the collection block: the repeated items are its child elements */
  host: HTMLElement;
  /** the repeated items that exist now (changed in place) */
  rows: PageItem[];
  /** how many repeated items there must be */
  wanted: number;
  /** creates the new state of repeated item number `index` (from the template and the record) */
  buildRow(index: number): PageItem;
  /** the repeated item the user changed: it is already up to date */
  origin?: PageItem;
  env: ReconcileEnv;
  /** called between the creation of two NEW repeated items, to let the browser paint (initial render only) */
  yieldToBrowser?: () => Promise<void>;
}

export interface CollectionSyncContext {
  /** the collection block (its `template` and `children` are the state that is updated) */
  owner: PageItem;
  /** element of the collection block */
  host: HTMLElement;
  /** records shown now: one repeated item per record */
  records: any[];
  env: ReconcileEnv;
  yieldToBrowser?: () => Promise<void>;
}

/** renders / updates the repeated items for the current records and template */
export async function syncRows(ctx: CollectionSyncContext, origin?: PageItem): Promise<void> {
  const template = ctx.owner.template;
  if (!template) return;
  await reconcileRows({
    owner: ctx.owner,
    host: ctx.host,
    rows: ctx.owner.children,
    wanted: ctx.records.length,
    buildRow: (index) => cloneTemplate(ctx.records, template, index),
    origin,
    env: ctx.env,
    yieldToBrowser: ctx.yieldToBrowser,
  });
}

/**
 * The user changed `origin` (one of the repeated items): the other items must get the same change.
 *  1. the changed item becomes the new template (light data copy);
 *  2. style only change: nothing to render (see below);
 *  3. otherwise the other items are updated in place.
 */
export async function applyTemplateChange(ctx: CollectionSyncContext, origin: PageItem): Promise<void> {
  const owner = ctx.owner;
  const originIndex = owner.children.indexOf(origin);
  const previous = owner.template;
  if (originIndex < 0 || !previous) return; // it was removed meanwhile

  const template = snapshotTemplate(origin, previous, ctx.records[originIndex]);
  owner.template = template;

  if (isSameTemplate(previous, template)) {
    // Only the style changed: the stylesheet rule (one per block id) is shared by all items already, so every item
    // shows the new style without any work. Only the style object is shared again.
    for (const row of owner.children) {
      if (row !== origin) shareTemplateCss(row, template);
    }
    return;
  }
  await syncRows(ctx, origin);
}

/**
 * Brings the rendered repeated items of a collection to the state described by the template, WITHOUT rebuilding them:
 *  - an item that already exists is compared with its new state, only the differences are applied
 *    (block added / removed / moved, text, attributes, classes, ...);
 *  - missing items are created, surplus items destroyed.
 * The work is proportional to what changed, not to (number of items x number of blocks).
 */
export async function reconcileRows(o: ReconcileRowsOptions): Promise<void> {
  const { rows, host, owner, env } = o;

  // 1. surplus items
  while (rows.length > o.wanted) {
    await env.destroyBlock(rows.pop()!);
  }

  // 2. existing items (compared by position: records have no identity)
  for (let i = 0; i < rows.length; i++) {
    if (env.isCancelled()) return;
    const current = rows[i];
    if (current === o.origin) continue;

    const next = o.buildRow(i);
    next.parent = owner;
    if (!(await reconcileNode(current, next, host, env))) {
      rows[i] = await replaceBlock(current, next, host, env);
    }
  }

  // 3. missing items
  for (let i = rows.length; i < o.wanted; i++) {
    if (env.isCancelled()) return;
    const next = o.buildRow(i);
    next.parent = owner;
    await env.createBlock(next, host, -1);
    rows.push(next);
    if (o.yieldToBrowser) await o.yieldToBrowser();
  }
}

/**
 * true when `current` can not be updated in place and must be created again:
 * the element / the directives of the block would be different.
 */
function needsReplace(current: PageItem, next: PageItem): boolean {
  if (current.tag !== next.tag) return true;
  // NgxDropList is attached to blocks that can have children
  if (!!current.canHaveChild !== !!next.canHaveChild) return true;
  // text blocks without a binding are inline editable (directive)
  if (!!current.dataSource?.binding !== !!next.dataSource?.binding) return true;

  const a = current.customComponent;
  const b = next.customComponent;
  if (!!a !== !!b) return true;
  if (a && b) {
    if (a.componentKey !== b.componentKey) return true;
    // the settings of a component are the input of its constructor: new settings = new component
    if (!isSameData(a.componentData, b.componentData)) return true;
  }
  return false;
}

/**
 * Applies the differences between the rendered block `current` and its new state `next` (same block, same id).
 * @returns false when the block must be replaced (nothing is changed in that case)
 */
async function reconcileNode(
  current: PageItem,
  next: PageItem,
  parentEl: HTMLElement,
  env: ReconcileEnv,
): Promise<boolean> {
  // the element must still be where we expect it (a failed render / a destroyed block is replaced)
  if (!current.el || current.el.parentElement !== parentEl) return false;
  if (needsReplace(current, next)) return false;
  if (!env.patchBlock(current, next)) return false;

  // a custom component renders (and manages) its own content
  if (current.customComponent) return true;

  await reconcileChildren(current, next, env);
  return true;
}

/** children are matched by id: add, remove, move, keep */
async function reconcileChildren(current: PageItem, next: PageItem, env: ReconcileEnv): Promise<void> {
  const parentEl = current.el!;
  const want = next.children ?? [];
  const have = current.children;

  const wantedIds = new Set(want.map((c) => c.id));
  const byId = new Map<string, PageItem>();
  for (const child of have) {
    if (wantedIds.has(child.id) && !byId.has(child.id)) byId.set(child.id, child);
  }

  // removed blocks (destroy first: the positions of the rest are then simple)
  for (const child of have) {
    if (byId.get(child.id) !== child) await env.destroyBlock(child);
  }

  const result: PageItem[] = [];
  let previousEl: Element | null = null;
  for (const wantedChild of want) {
    let child: PageItem | undefined = byId.get(wantedChild.id);

    if (!child) {
      // new block: render the new state itself
      child = wantedChild;
      child.parent = current;
      const index = previousEl ? indexInParent(parentEl, previousEl) + 1 : 0;
      await env.createBlock(child, parentEl, index);
    } else if (!(await reconcileNode(child, wantedChild, parentEl, env))) {
      // can not be updated in place: render the new state at the position of the old element
      const index = indexInParent(parentEl, child.el);
      await env.destroyBlock(child);
      child = wantedChild;
      child.parent = current;
      await env.createBlock(child, parentEl, index);
    }

    // moved block: put the element right after the previous one
    const el = child.el;
    if (el && el.previousElementSibling !== previousEl) {
      parentEl.insertBefore(el, previousEl ? previousEl.nextSibling : parentEl.firstChild);
    }

    result.push(child);
    previousEl = el ?? previousEl;
  }

  // the array is shared with the drop list of the element: change it in place
  have.splice(0, have.length, ...result);
}

/** destroys `current` and renders `next` at the same position */
async function replaceBlock(
  current: PageItem,
  next: PageItem,
  parentEl: HTMLElement,
  env: ReconcileEnv,
): Promise<PageItem> {
  const index = indexInParent(parentEl, current.el);
  await env.destroyBlock(current);
  next.parent = current.parent;
  await env.createBlock(next, parentEl, index);
  return next;
}

function indexInParent(parentEl: HTMLElement, el: Element | null | undefined): number {
  if (!el) return -1;
  return Array.prototype.indexOf.call(parentEl.children, el);
}
