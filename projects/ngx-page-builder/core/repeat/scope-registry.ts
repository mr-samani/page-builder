import type { DataScope } from '../data/scope';

/**
 * Which record is an element rendered for? Rows register their scope on their root element;
 * a nested collection (or any component created inside a row) finds it by walking up the DOM.
 * This works for components created imperatively (no Angular DI parent) and costs nothing when unused.
 */
const registry = new WeakMap<Node, DataScope>();

export function registerScope(el: Node, scope: DataScope): void {
  registry.set(el, scope);
}

export function unregisterScope(el: Node): void {
  registry.delete(el);
}

/** The scope of the nearest ancestor row/record (the element itself included). */
export function findScope(el: Node | null | undefined): DataScope | undefined {
  for (let n: Node | null | undefined = el; n; n = n.parentNode) {
    const s = registry.get(n);
    if (s) return s;
  }
  return undefined;
}
