import { HistoryOperation, HistoryPosition, HistorySubtree } from './types';

export function invertOperation(operation: HistoryOperation): HistoryOperation {
  switch (operation.type) {
    case 'set':
      return { ...operation, before: operation.after, after: operation.before };
    case 'insert':
      return { ...operation, type: 'remove' };
    case 'remove':
      return { ...operation, type: 'insert' };
    case 'move':
      return { ...operation, from: operation.to, to: operation.from };
  }
}

export function isNoop(operation: HistoryOperation): boolean {
  if (operation.type === 'set')
    return serializeHistoryValue(operation.before) === serializeHistoryValue(operation.after);
  return (
    operation.type === 'move' &&
    operation.from.parentId === operation.to.parentId &&
    operation.from.index === operation.to.index
  );
}

export function validateOperation(operation: HistoryOperation): void {
  const position = (value: HistoryPosition) => {
    if (
      !value ||
      (value.parentId !== null && (typeof value.parentId !== 'string' || !value.parentId)) ||
      !Number.isSafeInteger(value.index) ||
      value.index < 0
    )
      throw new TypeError('Invalid history position.');
  };
  const id = (value: string) => {
    if (typeof value !== 'string' || !value) throw new TypeError('A stable nonempty ID is required.');
  };
  if (!operation) throw new TypeError('Invalid history operation.');
  switch (operation.type) {
    case 'set':
      id(operation.id);
      if (
        !Array.isArray(operation.path) ||
        !operation.path.length ||
        operation.path.some((key) => typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key))
      )
        throw new TypeError('Invalid property path.');
      for (const state of [operation.before, operation.after]) {
        if (!state || typeof state.exists !== 'boolean' || (state.exists && !Object.hasOwn(state, 'value')))
          throw new TypeError('Invalid property state.');
      }
      return;
    case 'insert':
    case 'remove':
      position(operation.position);
      validateSubtree(operation.node);
      return;
    case 'move':
      id(operation.id);
      position(operation.from);
      position(operation.to);
      return;
    default:
      throw new TypeError('Unknown history operation.');
  }
}

export function validateSubtree(node: HistorySubtree, ids = new Set<string>()): void {
  if (!node || typeof node.id !== 'string' || !node.id || ids.has(node.id))
    throw new TypeError('Missing or duplicate node ID.');
  ids.add(node.id);
  if (
    !node.properties ||
    typeof node.properties !== 'object' ||
    Array.isArray(node.properties) ||
    !Array.isArray(node.children)
  ) {
    throw new TypeError('A node requires a properties object and children array.');
  }
  for (const child of node.children) validateSubtree(child, ids);
}

export function cloneHistoryValue<T>(value: T): T {
  return JSON.parse(serializeHistoryValue(value)) as T;
}

/** Canonical JSON of the DELTA only. No document scan to discover changes. */
export function serializeHistoryValue(value: unknown): string {
  const ancestors = new WeakSet<object>();
  const visit = (value: unknown): unknown => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0)) return value;
    if (typeof value !== 'object' || value === null)
      throw new TypeError('Use plain JSON data; undefined, functions and non-finite numbers are not supported.');
    if (ancestors.has(value)) throw new TypeError('Circular history data.');
    const array = Array.isArray(value);
    if (!array && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
      throw new TypeError('Convert runtime instances to data first.');
    if (Object.getOwnPropertySymbols(value).length) throw new TypeError('Symbol properties are not supported.');
    ancestors.add(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const result: unknown[] | Record<string, unknown> = array ? [] : Object.create(null);
    const keys = Object.keys(descriptors)
      .filter((key) => !(array && key === 'length'))
      .sort();
    if (
      array &&
      (keys.length !== value.length || keys.some((key) => !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))
    )
      throw new TypeError('Sparse/custom arrays are not supported.');
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!descriptor.enumerable || !('value' in descriptor))
        throw new TypeError('Getters/non-enumerable properties are not supported.');
      (result as Record<string, unknown>)[key] = visit(descriptor.value);
    }
    ancestors.delete(value);
    return result;
  };
  return JSON.stringify(visit(value));
}
