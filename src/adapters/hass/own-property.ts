import { ownValue } from "../../domain/own-value";
import { withinTextCap } from "../../domain/text/limits";

export { isObject, ownValue } from "../../domain/own-value";

/** A string within the cap of ADR 0002 « Parsing limits » item 3, or `undefined`: over-cap strings are never cut. */
export function boundedText(value: unknown): string | undefined {
  return typeof value === "string" && withinTextCap(value) ? value : undefined;
}

/**
 * A non-empty string within the cap, or `undefined`: a registry id (floor, area), matched the same way in every source,
 * or a display string (language code, robot name).
 */
export function boundedId(value: unknown): string | undefined {
  const id = boundedText(value);
  return id === "" ? undefined : id;
}

/** Whether an untrusted array holds `item`, each index read as an own data property, without copying the array. */
export function hasOwnString(value: unknown, item: string): boolean {
  if (!Array.isArray(value)) return false;
  const length = value.length;
  for (let i = 0; i < length; i++) {
    if (ownValue(value, String(i)) === item) return true;
  }
  return false;
}

/** The string items of an untrusted array, in order, each read as an own data property; `[]` for a non-array. */
export function ownStrings(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  const strings: string[] = [];
  for (let i = 0; i < value.length; i++) {
    const item = ownValue(value, String(i));
    if (typeof item === "string") strings.push(item);
  }
  return Object.freeze(strings);
}
