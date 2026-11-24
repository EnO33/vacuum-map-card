// Reading untrusted data (Home Assistant state, dashboard configuration) without ever running its code.

/** An own data property's value, or `undefined` for a missing or accessor property (its getter never runs). */
export function ownValue(source: object, name: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(source, name);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

/** A non-null object, the only kind of value whose own properties are read. */
export function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}
