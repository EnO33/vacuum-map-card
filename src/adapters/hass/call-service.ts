import type { ServiceCall, ServiceResult } from "../../app/ports/service-call";
import type { FrontendHass } from "./frontend-hass";
import { serviceErrorOf } from "./service-error";

/**
 * `HassPort.callService` over the live frontend `hass`: sent once with `notifyOnError = false` (the card shows the
 * error once, ADR 0003 « Errors ») and `returnResponse = false`. Never rejects: a rejection or a synchronous throw
 * becomes a bounded `ServiceError`; the response of a success is never read. Never retried (ADR 0003
 * « Confirmation »), never logged.
 */
export async function callService(getHass: () => FrontendHass, call: ServiceCall): Promise<ServiceResult> {
  try {
    await getHass().callService(call.domain, call.service, call.data, call.target, false, false);
    return { ok: true };
  } catch (rejection) {
    return { ok: false, error: serviceErrorOf(rejection) };
  }
}
