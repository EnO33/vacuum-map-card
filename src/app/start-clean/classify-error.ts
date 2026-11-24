import { type CleanError, type CoreCleanErrorKind, mayHaveStartedAfter } from "../../domain/clean/clean-error";
import { fallbackText } from "../../domain/text/fallback-text";
import type { RoomSource, SourceRobot } from "../ports/room-source";
import type { ServiceError } from "../ports/service-call";

/** The integration that answered the call: its domain and the robot's `classifyError` (#47). */
export type ErrorSource = Pick<RoomSource, "integration"> & Pick<SourceRobot, "classifyError">;

export interface ClassifyContext {
  /** The path the call took (ADR 0003): case 10 means a different thing on each. */
  readonly path: 1 | 2;
  readonly source: ErrorSource;
}

/** Translated core errors, keyed by `translation_domain` then `translation_key` (ADR 0003 « Errors »). */
const BY_KEY: ReadonlyMap<string, ReadonlyMap<string, CoreCleanErrorKind>> = new Map([
  [
    "homeassistant",
    new Map<string, CoreCleanErrorKind>([
      ["service_does_not_support_response", "card_problem"],
      ["service_not_supported", "no_area_cleaning"],
    ]),
  ],
  [
    "vacuum",
    new Map<string, CoreCleanErrorKind>([
      ["area_mapping_not_configured", "rooms_not_linked"],
      // The card sends one area per call, so nothing started (ADR 0003 « Path 1 », « Call »).
      ["areas_not_mapped", "area_not_linked"],
    ]),
  ],
]);

/**
 * A failed call as a typed clean error. An error in the integration's own translation domain is classified by the
 * integration's adapter, whatever its websocket code; then the core cases; anything else is `unknown`, possibly
 * started, with an untranslated message as a bounded text fallback. Lookups use `Map`s only, so a key such as
 * `__proto__` is just unknown.
 */
export function classifyCleanError(error: ServiceError, { path, source }: ClassifyContext): CleanError {
  if (error.translationDomain === source.integration) {
    const kind = source.classifyError(error);
    return kind ? { kind, mayHaveStarted: mayHaveStartedAfter(kind) } : unknown(error);
  }
  const kind = coreKind(error, path);
  return kind ? { kind, mayHaveStarted: "no" } : unknown(error);
}

function coreKind(error: ServiceError, path: 1 | 2): CleanError["kind"] | undefined {
  const { code, translationDomain, translationKey } = error;
  const serviceMissing = path === 1 ? "ha_lacks_area_cleaning" : "integration_not_ready";
  if (translationDomain !== undefined || translationKey !== undefined) {
    if (translationDomain === "homeassistant" && translationKey === "service_not_found") return serviceMissing;
    return translationDomain === undefined || translationKey === undefined
      ? undefined
      : BY_KEY.get(translationDomain)?.get(translationKey);
  }
  if (code === "invalid_format") return "card_problem";
  if (code === "not_found") return serviceMissing;
  // Case 4: `Unauthorized` passes its class name as the message and sets no translation key.
  if (code === "home_assistant_error" && error.message === "Unauthorized") return "not_allowed";
  // `unknown_error` (cases 5 and 9) is also any crash of the called service, maybe after the start: unknown.
  return undefined;
}

/** Unknown and possibly started. Only an untranslated, non-empty message other than a crash's is kept, as text. */
function unknown(error: ServiceError): CleanError {
  const { message, translationKey, code } = error;
  const keep = message !== undefined && message !== "" && translationKey === undefined && code !== "unknown_error";
  return keep
    ? { kind: "unknown", mayHaveStarted: "unknown", fallbackMessage: fallbackText(message) }
    : { kind: "unknown", mayHaveStarted: "unknown" };
}
