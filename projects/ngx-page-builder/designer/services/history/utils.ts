import { HistoryOperation } from './types';

export function invertOperation(operation: HistoryOperation<any>): HistoryOperation<any> {
  switch (operation.type) {
    case 'set':
      return { ...operation, before: operation.after, after: operation.before };
    case 'insert':
      return { ...operation, type: 'remove' };
    case 'remove':
      return { ...operation, type: 'insert' };
    case 'move':
      return { ...operation, fromIndex: operation.toIndex, toIndex: operation.fromIndex };
  }
}

export function isNoop(operation: any): boolean {
  if (operation.type === 'set')
    return serializeHistoryValue(operation.before) === serializeHistoryValue(operation.after);
  return operation.type === 'move' && operation.fromIndex === operation.toIndex && operation.node === operation.node;
}

export function validateOperation(operation: HistoryOperation<any>): void {
  const position = (value?: number) => {
    if (!value || !Number.isSafeInteger(value) || value < 0) throw new TypeError('Invalid history position.');
  };
  const id = (value: string) => {
    if (typeof value !== 'string' || !value) throw new TypeError('A stable nonempty ID is required.');
  };
  if (!operation) throw new TypeError('Invalid history operation.');
  switch (operation.type) {
    case 'set':
      id(operation.id);

      for (const state of [operation.before, operation.after]) {
        if (!state || typeof state.exists !== 'boolean' || (state.exists && !Object.hasOwn(state, 'value')))
          throw new TypeError('Invalid property state.');
      }
      return;
    case 'insert':
    case 'remove':
      position(operation.index);
      validateSubtree(operation.node);
      return;
    case 'move':
      id(operation.id);
      position(operation.fromIndex);
      position(operation.toIndex);
      return;
    default:
      throw new TypeError('Unknown history operation.');
  }
}

export function validateSubtree(node: any, ids = new Set<string>()): void {
  if (!node || typeof node.id !== 'string' || !node.id || ids.has(node.id))
    throw new TypeError('Missing or duplicate node ID.');
  ids.add(node.id);
  if (!Array.isArray(node.children)) {
    throw new TypeError('A node requires a properties object and children array.');
  }
  for (const child of node.children) validateSubtree(child, ids);
}

/** Canonical JSON of the DELTA only. No document scan to discover changes. */
export async function serializeHistoryValue<T>(value: HistoryOperation<T>): Promise<string> {
  const clone = await serializeSafe(value);
  return JSON.stringify(clone);
}

export function serializeSafe(value: unknown): any {
  const seen = new WeakSet<object>();

  function clean(value: unknown): unknown {
    if (value === null) {
      return null;
    }

    const type = typeof value;

    // Primitive
    if (type === 'string' || type === 'number' || type === 'boolean') {
      return value;
    }

    // چیزهایی که نمی‌خواهیم
    if (type === 'undefined' || type === 'function' || type === 'symbol') {
      return undefined;
    }

    // BigInt
    if (type === 'bigint') {
      return `${value}n`;
    }

    if (type !== 'object') {
      return undefined;
    }

    // Circular reference
    if (seen.has(value as object)) {
      return undefined;
    }

    seen.add(value as object);

    // DOM
    if (typeof Node !== 'undefined' && value instanceof Node) {
      return undefined;
    }

    // Date
    if (value instanceof Date) {
      return value.toISOString();
    }

    // Array
    if (Array.isArray(value)) {
      return value.map(clean).filter((x) => x !== undefined);
    }

    // Map
    if (value instanceof Map) {
      const result: unknown[] = [];

      for (const [key, item] of value) {
        const k = clean(key);
        const v = clean(item);

        if (k !== undefined && v !== undefined) {
          result.push([k, v]);
        }
      }

      return result;
    }

    // Set
    if (value instanceof Set) {
      return [...value].map(clean).filter((x) => x !== undefined);
    }

    // ArrayBuffer / typed arrays / binary data
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      return undefined;
    }

    // Object / class instance
    const result: Record<string, unknown> = {};

    for (const key of Object.keys(value ?? {})) {
      const cleaned = clean((value as Record<string, unknown>)[key]);

      if (cleaned !== undefined) {
        result[key] = cleaned;
      }
    }

    return result;
  }

  return clean(value);
}
