import type { DisplayPort } from "../../app/ports/display-port";
import type { FrontendHass } from "./frontend-hass";
import { boundedId, isObject, ownValue } from "./own-property";
import { stateObjectOf } from "./picture-state";

/**
 * `DisplayPort` over the live frontend `hass`, read again on each call. Every field may be `null` early
 * (`docs/research/ha-frontend.md` § 1), so each read degrades to `undefined` and never throws. Only a non-empty string
 * within the cap of ADR 0002 « Parsing limits » item 3 crosses, never cut. The port is frozen, its two members only.
 */
export function createDisplay(getHass: () => FrontendHass | null | undefined): DisplayPort {
  const display: DisplayPort = {
    language: () => {
      const hass = getHass();
      if (!isObject(hass)) return undefined;
      const locale = hass.locale;
      return (isObject(locale) ? boundedId(ownValue(locale, "language")) : undefined) ?? boundedId(hass.language);
    },
    robotName: (vacuumEntityId) => {
      const hass = getHass();
      const stateObject = isObject(hass) ? stateObjectOf(hass.states, vacuumEntityId) : undefined;
      const attributes = stateObject === undefined ? undefined : ownValue(stateObject, "attributes");
      return isObject(attributes) ? boundedId(ownValue(attributes, "friendly_name")) : undefined;
    },
  };
  return Object.freeze(display);
}
