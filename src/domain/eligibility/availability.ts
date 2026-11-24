/** Whether a robot can be offered at all (ADR 0003 « Eligibility (both paths) »). */
export type Availability =
  | { readonly kind: "startable"; readonly state: string }
  | { readonly kind: "not_startable"; readonly reason: "unavailable" | "no_state" };

/**
 * A robot is startable in every state except `unavailable`, including `unknown` and `error` (owner decision,
 * 2026-11-23). A vacuum with no state (missing or disabled) is not: calls to it succeed and do nothing. A robot that
 * is not startable never falls back to another path.
 */
export function robotAvailability(vacuum: { readonly state: string } | undefined): Availability {
  if (vacuum === undefined) return { kind: "not_startable", reason: "no_state" };
  if (vacuum.state === "unavailable") return { kind: "not_startable", reason: "unavailable" };
  return { kind: "startable", state: vacuum.state };
}
