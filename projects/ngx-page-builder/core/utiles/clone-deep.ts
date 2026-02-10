export function cloneDeep<T>(value: T, stack = new WeakMap()): T {
  // Handle primitives
  if (value === null || typeof value !== 'object') {
    return value;
  }

  // Handle circular references
  if (stack.has(value as any)) {
    return stack.get(value as any);
  }

  // Handle Date
  if (value instanceof Date) {
    return new Date(value) as any;
  }

  // Handle RegExp
  if (value instanceof RegExp) {
    return new RegExp(value.source, value.flags) as any;
  }

  // Handle Array
  if (Array.isArray(value)) {
    const arr: any[] = [];
    stack.set(value as any, arr);
    for (let i = 0; i < value.length; i++) {
      arr[i] = cloneDeep(value[i], stack);
    }
    return arr as any;
  }

  // Handle Map
  if (value instanceof Map) {
    const result = new Map();
    stack.set(value as any, result);
    value.forEach((val, key) => {
      result.set(cloneDeep(key, stack), cloneDeep(val, stack));
    });
    return result as any;
  }

  // Handle Set
  if (value instanceof Set) {
    const result = new Set();
    stack.set(value as any, result);
    value.forEach((val) => {
      result.add(cloneDeep(val, stack));
    });
    return result as any;
  }

  // Handle TypedArrays
  if (ArrayBuffer.isView(value)) {
    return new (value.constructor as any)(value) as any;
  }

  // Handle plain objects
  const clonedObj: Record<string | symbol, any> = {};
  stack.set(value as any, clonedObj);

  Reflect.ownKeys(value).forEach((key) => {
    clonedObj[key as any] = cloneDeep((value as any)[key], stack);
  });

  return clonedObj as T;
}

// utils/clone-safe.ts
export function deepCloneInstance<T>(
  input: T,
  options: { cloneDom?: boolean } = { cloneDom: false },
): T {
  const { cloneDom } = options;
  const map = new WeakMap<any, any>();

  function _clone(value: any): any {
    if (value === null || typeof value !== 'object') return value;
    if (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) {
      return cloneDom ? (value.cloneNode ? value.cloneNode(true) : value) : value;
    }
    if (map.has(value)) return map.get(value);
    let copy: any;
    try {
      copy = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value) || {});
    } catch (e) {
      copy = Array.isArray(value) ? [] : {};
    }
    map.set(value, copy);
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) copy[i] = _clone(value[i]);
      return copy;
    }
    for (const key of Object.keys(value)) {
      if (typeof value[key] === 'function') continue;
      copy[key] = _clone(value[key]);
    }
    return copy;
  }

  return _clone(input) as T;
}
