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
  const key = bounded(ownValue(rejection, "translation_key"));
  const message = untranslated(rejection) ? bounded(ownValue(rejection, "message")) : undefined;
  return {
    code: code === undefined || code === "" ? "unknown_error" : code,
    ...(message === undefined ? {} : { message }),
    ...(domain === undefined ? {} : { translationDomain: domain }),
    ...(key === undefined ? {} : { translationKey: key }),
  };
}

/**
 * Whether the error has no `translation_key`: none at all, or an own data property holding `undefined` or `null`. An
 * accessor or an inherited key counts as present, so its message, whose placeholders may be filled in, is dropped.
 */
function untranslated(source: object): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(source, "translation_key");
  if (descriptor === undefined) return !("translation_key" in source);
  return "value" in descriptor && (descriptor.value === undefined || descriptor.value === null);
}

/** An own data property's value, or `undefined` for a missing or accessor property (its getter never runs). */
function ownValue(source: object, name: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(source, name);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

function bounded(value: unknown): string | undefined {
  return typeof value === "string" && withinTextCap(value) ? value : undefined;
}
