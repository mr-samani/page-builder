export function isEqual<T = any>(a: T, b: T): boolean {
  // 1. Check for strict equality (handles primitives and same reference)
  if (a === b) {
    return true;
  }

  // 2. Check if either is null or not an object (if so, they are not equal because strict equality failed)
  if (a === null || typeof a !== 'object' || b === null || typeof b !== 'object') {
    return false;
  }

  // 3. Check if the constructors are different (e.g., Array vs Object)
  if (a.constructor !== b.constructor) {
    return false;
  }

  // 4. Handle Date objects specifically
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  // 5. Get keys of both objects
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  // 6. Check if the number of keys is different
  if (keysA.length !== keysB.length) {
    return false;
  }

  // 7. Recursively check every key
  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];

    // Check if the key exists in B and if the values are deeply equal
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !isEqual((a as any)[key], (b as any)[key])
    ) {
      return false;
    }
  }

  return true;
}
