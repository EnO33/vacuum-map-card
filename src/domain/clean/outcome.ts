import type { CleanError } from "./clean-error";

/**
 * What a confirmed start ended with, stored per robot until acknowledged. `accepted` means Home Assistant accepted
 * the call, never « cleaning »: progress comes only from later vacuum states (ADR 0003 « When the checks run »).
 */
export type StoredOutcome =
  | { readonly kind: "accepted" }
  /** Something the intent captured differs now: nothing was sent, the user is asked to try again. */
  | { readonly kind: "changed" }
  | { readonly kind: "error"; readonly error: CleanError };
