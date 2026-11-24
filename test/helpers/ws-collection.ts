// Test helper for `src/adapters/hass/ws-collection.ts`: a list of names, its parser, and a deferred `callWS` answer.

import { createWsCollection, type WsCollection } from "../../src/adapters/hass/ws-collection";
import type { FakeFrontendHass } from "../fakes/frontend-hass";

export const COMMAND = "config/thing_registry/list";
export const EVENT = "thing_registry_updated";

export interface Things {
  readonly names: readonly string[];
}

/** Accepts an array of strings, refuses anything else. */
export function parse(raw: unknown): Things | undefined {
  return Array.isArray(raw) && raw.every((item) => typeof item === "string") ? { names: raw } : undefined;
}

export const equal = (a: Things, b: Things) => a.names.join("\n") === b.names.join("\n");

/** A collection of `Things` over `hass`, with `listener` added. */
export function thingsCollection(hass: FakeFrontendHass, listener: () => void): WsCollection<Things> {
  const made = createWsCollection({ getHass: () => hass, command: COMMAND, event: EVENT, parse, equal });
  made.onChange(listener);
  return made;
}

/** A deferred `callWS` answer the test settles by hand. */
export function deferred() {
  let resolve: (value: unknown) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<unknown>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
