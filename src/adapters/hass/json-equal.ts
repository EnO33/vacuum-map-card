import { isObject, ownValue } from "./own-property";

/** Deepest nesting compared; deeper values count as different, so a hostile depth cannot overflow the stack. */
export const MAX_JSON_DEPTH = 64;

/**
 * Structural equality of two untrusted JSON values, such as an unparsed `options.vacuum`: primitives by `===`, arrays
 * item by item, objects by their own keys in any order. Values are read through `ownValue`, so no getter runs; this
 * is why `app`'s `sameValue` (`Reflect.get`, key order significant) is not reused on registry data.
 */
export function jsonEqual(a: unknown, b: unknown, depth = 0): boolean {
  if (a === b) return true;
  if (depth >= MAX_JSON_DEPTH) return false;
  if (!isObject(a) || !isObject(b) || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => Object.hasOwn(b, key) && jsonEqual(ownValue(a, key), ownValue(b, key), depth + 1));
}
