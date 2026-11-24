import type { StoredOutcome } from "../../domain/clean/outcome";
import type { Intent } from "./intent";

// A plain value of the domain, so the progress of a room (`domain/clean/progress.ts`) can read it.
export type { StoredOutcome } from "../../domain/clean/outcome";

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

export type SendingListener = (intent: Intent) => void;
