import type { ServiceError } from "../../app/ports/service-call";
import { withinTextCap } from "../../domain/text/limits";

const UNKNOWN: ServiceError = Object.freeze({ code: "unknown_error" });

/**
 * The bounded `ServiceError` of a rejected call (`src/app/ports/service-call.ts`), built from the rejection value's own
 * data properties only, whatever it is (a websocket error, a result message, an `Error`, anything thrown). Each
 * property is read once, through its descriptor, so no getter ever runs:
 * - `code`: a non-empty string within the cap, else `unknown_error`;
 * - `translationDomain` and `translationKey`: kept when strings within the cap;
 * - `message`: kept only when the error has no `translation_key` (a translated message has the placeholders filled
 *   in) and it is a string within the cap;
 * - `translation_placeholders` is never read. Over-cap strings are dropped, never cut.
 */
export function serviceErrorOf(rejection: unknown): ServiceError {
  try {
    return parse(rejection);
  } catch {
    // A hostile proxy: nothing can be read from it.
    return UNKNOWN;
  }
}

function parse(rejection: unknown): ServiceError {
  if (typeof rejection !== "object" || rejection === null) return UNKNOWN;
  const code = bounded(ownValue(rejection, "code"));
  const domain = bounded(ownValue(rejection, "translation_domain"));
  const rawKey = ownValue(rejection, "translation_key");
  const key = bounded(rawKey);
  const message = rawKey === undefined || rawKey === null ? bounded(ownValue(rejection, "message")) : undefined;
  return {
    code: code === undefined || code === "" ? "unknown_error" : code,
    ...(message === undefined ? {} : { message }),
    ...(domain === undefined ? {} : { translationDomain: domain }),
    ...(key === undefined ? {} : { translationKey: key }),
  };
}

/** An own data property's value, or `undefined` for a missing or accessor property (its getter never runs). */
function ownValue(source: object, name: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(source, name);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

function bounded(value: unknown): string | undefined {
  return typeof value === "string" && withinTextCap(value) ? value : undefined;
}
