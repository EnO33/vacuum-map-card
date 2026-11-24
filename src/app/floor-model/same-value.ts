/**
 * Deep equality of plain data: arrays, `Map`s, plain objects, and primitives by `Object.is`. The same object short-cuts
 * at every level, so inputs the ports keep stable cost almost nothing to compare.
 */
export function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => sameValue(x, b[i]));
  }
  if (a instanceof Map || b instanceof Map) {
    return a instanceof Map && b instanceof Map && a.size === b.size && sameValue([...a], [...b]);
  }
  const keys = Object.keys(a);
  const otherKeys = Object.keys(b);
  return (
    keys.length === otherKeys.length &&
    keys.every((key, i) => key === otherKeys[i] && sameValue(Reflect.get(a, key), Reflect.get(b, key)))
  );
}
