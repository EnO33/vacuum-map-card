import type { VacuumState } from "../../app/ports/hass-port";
import type { FrontendHass } from "./frontend-hass";
import { boundedText, isObject, ownValue } from "./own-property";
import { stateObjectOf } from "./picture-state";

/**
 * `HassPort.vacuum()` over the live `hass.states`: `undefined` unless the entity id is an own key whose state object
 * has a string `state` within the cap (a missing entity is not startable, ADR 0003 « Eligibility »). The same object
 * is returned for the same state object, which Home Assistant replaces only when the entity changes.
 */
export function vacuumReader(getHass: () => FrontendHass): (entityId: string) => VacuumState | undefined {
  const read = new WeakMap<object, VacuumState | undefined>();
  return (entityId) => {
    const stateObject = stateObjectOf(getHass().states, entityId);
    if (stateObject === undefined) return undefined;
    if (!read.has(stateObject)) read.set(stateObject, parseVacuumState(stateObject));
    return read.get(stateObject);
  };
}

function parseVacuumState(stateObject: object): VacuumState | undefined {
  const state = boundedText(ownValue(stateObject, "state"));
  if (state === undefined) return undefined;
  const attributes = ownValue(stateObject, "attributes");
  const features = isObject(attributes) ? ownValue(attributes, "supported_features") : undefined;
  return Object.freeze({ state, supportedFeatures: featureMask(features) });
}

/** A non-negative safe integer, else `0`: no feature, so path 1 is not offered (the safe side). */
function featureMask(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
