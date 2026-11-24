import type { FrontendHass } from "./frontend-hass";
import { isObject, ownValue } from "./own-property";

/**
 * `HassPort.isAdmin()` over the live `hass.user`: `true` only for an own `is_admin` that is exactly `true`. It only
 * decides whether a settings link is shown (ADR 0003 « Permissions »).
 */
export function adminReader(getHass: () => FrontendHass): () => boolean {
  return () => {
    const user = getHass().user;
    return isObject(user) && ownValue(user, "is_admin") === true;
  };
}
