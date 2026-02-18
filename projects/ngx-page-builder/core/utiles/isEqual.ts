export function isEqual<T = unknown>(a: T, b: T): boolean {
  if (a === b) return true;

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    if ((a as any).constructor !== (b as any).constructor) return false;

    // Array
    if (Array.isArray(a)) {
      if (a.length !== (b as unknown[]).length) return false;
      for (let i = a.length; i-- !== 0; ) {
        if (!isEqual(a[i], (b as unknown[])[i])) return false;
      }
      return true;
    }

    // Map
    if (a instanceof Map && b instanceof Map) {
      if (a.size !== b.size) return false;
      for (const [key, value] of a) {
        if (!b.has(key)) return false;
        if (!isEqual(value, b.get(key))) return false;
      }
      return true;
    }

    // Set
    if (a instanceof Set && b instanceof Set) {
      if (a.size !== b.size) return false;
      for (const value of a) {
        if (!b.has(value)) return false;
      }
      return true;
    }

    // TypedArray / DataView
    if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
      if (a.byteLength !== b.byteLength) return false;

      const viewA = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
      const viewB = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);

      for (let i = viewA.length; i-- !== 0; ) {
        if (viewA[i] !== viewB[i]) return false;
      }

      return true;
    }

    // RegExp
    if (a instanceof RegExp && b instanceof RegExp) {
      return a.source === b.source && a.flags === b.flags;
    }

    // valueOf override (Date, etc.)
    if ((a as any).valueOf !== Object.prototype.valueOf) {
      return (a as any).valueOf() === (b as any).valueOf();
    }

    // Plain object
    const keys = Object.keys(a as Record<string, unknown>);
    if (keys.length !== Object.keys(b as Record<string, unknown>).length) return false;

    for (let i = keys.length; i-- !== 0; ) {
      const key = keys[i];
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (!isEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
    }

    return true;
  }

  return a !== a && b !== b; // NaN case
}
