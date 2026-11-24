import { withinTextCap } from "../../domain/text/limits";

/** An own data property's value, or `undefined` for a missing or accessor property (its getter never runs). */
export function ownValue(source: object, name: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(source, name);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

/** A string within the cap of ADR 0002 « Parsing limits » item 3, or `undefined`: over-cap strings are never cut. */
export function boundedText(value: unknown): string | undefined {
  return typeof value === "string" && withinTextCap(value) ? value : undefined;
}

/** A registry id (floor, area): a non-empty string within the cap, matched the same way in every source, or `undefined`. */
export function boundedId(value: unknown): string | undefined {
  const id = boundedText(value);
  return id === "" ? undefined : id;
}

/** A non-null object, the only kind of value whose own properties are read. */
export function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
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
