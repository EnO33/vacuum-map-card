import type { StoredOutcome } from "../../domain/clean/outcome";
import type { ItemRef } from "../robots-for-item/robots-for-item";

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

/**
 * A start the controller goes on to send: which robot, which item, and the vacuum's state at that moment (`undefined`
 * when it has none), never the path, map id, segments or call data of the intent.
 */
export interface Sending {
  readonly vacuumEntityId: string;
  readonly item: ItemRef;
  readonly vacuumState: string | undefined;
}

export type SendingListener = (sending: Sending) => void;
