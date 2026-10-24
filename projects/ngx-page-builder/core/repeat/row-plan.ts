import { compileBinding, isEmptyBinding, resolveBinding, applyBinding, type ApplyOptions, type BindableItem, type BoundValues, type CompiledBinding } from '../data/item-binding';
import { isOwner } from '../data/plan';
import type { DataScope } from '../data/scope';

/** A block of the template together with the element the pipeline rendered for it. */
export interface RenderedItem extends BindableItem {
  id: string;
  el?: Element | null;
  children?: RenderedItem[];
  template?: RenderedItem | null;
  dataSource?: { id?: string; binding?: string } | null;
  customComponent?: unknown;
}

export interface BoundNode {
  itemId: string;
  /** childNodes indexes from the row root down to the element */
  path: number[];
  binding: CompiledBinding;
}

export interface RowPlan {
  nodes: BoundNode[];
  /**
   * false when the template contains something `cloneNode` cannot copy faithfully
   * (a custom component, a nested collection) → rows must be built one by one through the block pipeline.
   */
  cloneable: boolean;
  /** some binding reads $index/$count/$last → earlier rows must be re-bound when rows are appended */
  usesLoop: boolean;
}

function pathTo(root: Node, el: Node): number[] | null {
  const path: number[] = [];
  for (let n: Node | null = el; n && n !== root; n = n.parentNode) {
    const parent: Node | null = n.parentNode;
    if (!parent) return null;
    path.push(Array.prototype.indexOf.call(parent.childNodes, n));
  }
  return el === root || (el.parentNode && contains(root, el)) ? path.reverse() : null;
}

function contains(root: Node, el: Node): boolean {
  for (let n: Node | null = el; n; n = n.parentNode) if (n === root) return true;
  return false;
}

/**
 * Describes where the bindings of a rendered template live, so a row can be produced with `cloneNode`
 * and patched by path (no block pipeline, no selectors, no per-row tree walk).
 * `rootEl` is the element rendered for `root`.
 */
export function buildRowPlan(root: RenderedItem, rootEl: Element, opts: { includeRoot?: boolean } = {}): RowPlan {
  const nodes: BoundNode[] = [];
  let cloneable = true;
  let usesLoop = false;
  const includeRoot = opts.includeRoot ?? true;

  const visit = (item: RenderedItem, isRoot: boolean) => {
    if (item.customComponent || (!isRoot && isOwner(item as never))) cloneable = false;
    const compiled = compileBinding(resolveBinding(item));
    if (!isEmptyBinding(compiled) && item.el && (includeRoot || !isRoot)) {
      usesLoop ||= compiled.usesLoop;
      const path = pathTo(rootEl, item.el);
      if (path) nodes.push({ itemId: item.id, path, binding: compiled });
    }
    // a nested owner's template belongs to ITS rows; do not bind it with ours
    if (!isRoot && isOwner(item as never)) return;
    item.children?.forEach((c) => visit(c, false));
  };
  visit(root, true);
  return { nodes, cloneable, usesLoop };
}

export function resolvePath(root: Node, path: readonly number[]): Element | null {
  let n: Node | undefined = root;
  for (const i of path) {
    n = n.childNodes[i];
    if (!n) return null;
  }
  return n as Element;
}

/** Resolves every bound node of a row element once (reused for every update of that row). */
export function resolveNodes(rowEl: Element, plan: RowPlan): (Element | null)[] {
  return plan.nodes.map((n) => resolvePath(rowEl, n.path));
}

/** One-shot binding of a row element (used by the slow path and by record scopes). */
export function bindRowOnce(rowEl: Element, plan: RowPlan, scope: DataScope, opts?: ApplyOptions): BoundValues[] {
  const nodes = resolveNodes(rowEl, plan);
  return plan.nodes.map((n, i) => (nodes[i] ? applyBinding(nodes[i]!, n.binding, scope, {}, opts) : {}));
}
