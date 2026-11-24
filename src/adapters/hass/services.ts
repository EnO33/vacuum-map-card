import type { FrontendHass } from "./frontend-hass";
import { isObject, ownValue } from "./own-property";

/**
 * `HassPort.hasService()` over the live `hass.services`, a JSON object whose key presence is reliable
 * (`docs/research/ha-core-vacuum.md` « Errors »). Own keys only, at both levels; a level that is not an object gives
 * `false`.
 */
export function serviceReader(getHass: () => FrontendHass): (domain: string, service: string) => boolean {
  return (domain, service) => {
    const services = getHass().services;
    if (!isObject(services)) return false;
    const domainServices = ownValue(services, domain);
    return isObject(domainServices) && Object.hasOwn(domainServices, service);
  };
}
