import type { PictureState } from "../../domain/robot/stored-map";
import type { EntityRegistryEntry } from "./entity-registry";
import { isObject, ownValue } from "./own-property";

/** The entity's state object: an own key of `hass.states` holding an object, else `undefined`. */
export function stateObjectOf(states: unknown, entityId: string): object | undefined {
  if (!isObject(states)) return undefined;
  const stateObject = ownValue(states, entityId);
  return isObject(stateObject) ? stateObject : undefined;
}

/** The state string of an image entity whose picture can be shown: any string but `unavailable` and `unknown`. */
export function shownStateOf(stateObject: object | undefined): string | undefined {
  const state = stateObject === undefined ? undefined : ownValue(stateObject, "state");
  return typeof state === "string" && state !== "unavailable" && state !== "unknown" ? state : undefined;
}

/**
 * The picture state of an enabled image entity from its state object: `available` for a shown state, `unavailable`
 * as itself, otherwise `unknown` (ADR 0005 « Plan pictures » item 3).
 */
export function imageStateOf(stateObject: object | undefined): Exclude<PictureState, "disabled"> {
  if (shownStateOf(stateObject) !== undefined) return "available";
  const state = stateObject === undefined ? undefined : ownValue(stateObject, "state");
  return state === "unavailable" ? "unavailable" : "unknown";
}

/**
 * Whether an image entity's picture can be shown (ADR 0005 « Plan pictures » items 3 and 5): `disabled` for a disabled
 * registry entry, even with a state, otherwise `imageStateOf`.
 */
export function pictureStateOf(entry: EntityRegistryEntry, stateObject: object | undefined): PictureState {
  return entry.disabled ? "disabled" : imageStateOf(stateObject);
}
