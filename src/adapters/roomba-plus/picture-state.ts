import type { PictureState } from "../../domain/robot/stored-map";
import type { EntityRegistryEntry } from "../hass/entity-registry";
import { isObject, ownValue } from "../hass/own-property";

/** The entity's state object: an own key of `hass.states` holding an object, else `undefined`. */
export function stateObjectOf(states: unknown, entityId: string): object | undefined {
  if (!isObject(states)) return undefined;
  const stateObject = ownValue(states, entityId);
  return isObject(stateObject) ? stateObject : undefined;
}

/**
 * Whether an image entity's picture can be shown (ADR 0005 « Plan pictures » items 3 and 5): `disabled` for a disabled
 * registry entry, even with a state; otherwise `unknown` without a state, `unavailable` and `unknown` as themselves,
 * and `available` for any other string state.
 */
export function pictureStateOf(entry: EntityRegistryEntry, stateObject: object | undefined): PictureState {
  if (entry.disabled) return "disabled";
  const state = stateObject === undefined ? undefined : ownValue(stateObject, "state");
  if (typeof state !== "string" || state === "unknown") return "unknown";
  return state === "unavailable" ? "unavailable" : "available";
}
