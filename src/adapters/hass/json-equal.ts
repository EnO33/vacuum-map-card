import { isObject, ownValue } from "./own-property";

/**
 * Structural equality of two JSON values, such as an unparsed `options.vacuum`: primitives by `===`, arrays item by
 * item, objects by their own keys in any order. Values are read through `ownValue`, so no getter runs.
 */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!isObject(a) || !isObject(b) || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => Object.hasOwn(b, key) && jsonEqual(ownValue(a, key), ownValue(b, key)));
}
