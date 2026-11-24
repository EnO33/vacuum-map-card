import type { IntegrationErrorKind } from "../robot/integration-error";

/** One kind per core meaning of ADR 0003 « Errors » (cases 1 to 10). Kinds name meanings; Epic 5 words them. */
export type CoreCleanErrorKind =
  /** Cases 1 and 2: the card sent bad data. */
  | "card_problem"
  /** Case 3: the robot cannot clean by area. */
  | "no_area_cleaning"
  /** Case 4: the user may not control this robot. */
  | "not_allowed"
  /**
   * Cases 5 and 9 as ADR 0003 first worded them. Not produced: their code, `unknown_error`, is also any crash of the
   * called service, so it is classified `unknown` (owner decision, 2026-11-24).
   */
  | "not_set_up_for_area_cleaning"
  /** Case 6: the robot's rooms are not linked to areas. */
  | "rooms_not_linked"
  /** Case 7: this area is not linked to the robot. */
  | "area_not_linked"
  /** Case 10 on path 1: this Home Assistant cannot clean by area. */
  | "ha_lacks_area_cleaning";

export type CleanErrorKind = CoreCleanErrorKind | IntegrationErrorKind | "unknown";

/**
 * A refused start, as the card tells it. `mayHaveStarted` says whether the robot could be moving anyway. Only
 * `fallbackMessage` holds server text, and only for an `unknown` error: it is shown as text, never as markup.
 */
export interface CleanError {
  readonly kind: CleanErrorKind;
  readonly mayHaveStarted: "no" | "possibly" | "unknown";
  readonly fallbackMessage?: string;
}

/**
 * Whether the robot may have started after an integration refusal. Every kind is a row of ADR 0003 « Errors »,
 * Roomba+ table, raised before the start command: an adapter maps to a kind only such a refusal (#47).
 */
export function mayHaveStartedAfter(_kind: IntegrationErrorKind): CleanError["mayHaveStarted"] {
  return "no";
}
