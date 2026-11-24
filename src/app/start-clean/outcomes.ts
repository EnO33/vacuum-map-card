import type { CleanError } from "../../domain/clean/clean-error";

/**
 * What a confirmed start ended with, stored per robot until acknowledged. `accepted` means Home Assistant accepted
 * the call, never « cleaning »: progress comes only from later vacuum states (ADR 0003 « When the checks run »).
 */
export type StoredOutcome =
  | { readonly kind: "accepted" }
  /** Something the intent captured differs now: nothing was sent, the user is asked to try again. */
  | { readonly kind: "changed" }
  | { readonly kind: "error"; readonly error: CleanError };

/** What `confirm` answers: a stored outcome, or why it sent nothing at once. */
export type ConfirmOutcome =
  | StoredOutcome
  /** A start for the same robot is in flight. */
  | { readonly kind: "busy" }
  /** This intent was already confirmed: one send per confirmation, never a retry. */
  | { readonly kind: "already_sent" }
  /** This intent was dismissed before it was confirmed. */
  | { readonly kind: "discarded" };

export type OutcomeListener = (vacuumEntityId: string, outcome: StoredOutcome) => void;
