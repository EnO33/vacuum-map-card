import type { CleanError } from "./clean-error";
import type { StoredOutcome } from "./outcome";

/** The progress of one robot on the room it was sent to (ADR 0003 « Amendment (2026-11-24) », « Progress on a room »). */
export type ProgressPhase =
  | "sending"
  | "starting"
  | "cleaning"
  | "paused"
  | "done"
  | "failed"
  | "may_have_started"
  | "not_started";

export interface Progress {
  readonly phase: ProgressPhase;
  /** The refused start, on `failed` from an `error` outcome and on `may_have_started`. */
  readonly error?: CleanError;
  /** The vacuum is `unavailable`, `unknown`, in a state the card does not know, or gone: the phase is kept. */
  readonly statusUnknown: boolean;
  /** While sending: the latest vacuum state reported since the confirm, applied once the outcome allows. */
  readonly held?: { readonly state: string | undefined };
}

export type ProgressEvent =
  | { readonly kind: "confirm_started" }
  | { readonly kind: "outcome"; readonly outcome: StoredOutcome }
  /** A new state of the vacuum entity; `undefined` when it left `hass.states`. */
  | { readonly kind: "vacuum_state"; readonly state: string | undefined };

export const SENDING: Progress = Object.freeze({ phase: "sending", statusUnknown: false });

/**
 * The next progress of one robot. Pure; returns the very `progress` it was given when nothing changed, so a caller
 * can tell a change by reference. Done, failed and not started end the progress: only a new confirm leaves them.
 */
export function nextProgress(progress: Progress, event: ProgressEvent): Progress {
  switch (event.kind) {
    case "confirm_started":
      return SENDING;
    case "outcome":
      return progress.phase === "sending" ? afterOutcome(progress, event.outcome) : progress;
    case "vacuum_state":
      return afterState(progress, event.state);
  }
}

function afterOutcome(sending: Progress, outcome: StoredOutcome): Progress {
  switch (outcome.kind) {
    case "accepted":
      return replay({ phase: "starting", statusUnknown: false }, sending.held);
    case "changed":
      return { phase: "not_started", statusUnknown: false };
    case "error": {
      const { error } = outcome;
      if (error.mayHaveStarted === "no") return { phase: "failed", error, statusUnknown: false };
      return replay({ phase: "may_have_started", error, statusUnknown: false }, sending.held);
    }
  }
}

/** A state seen while sending happened after the confirm: once the call may have started the robot, it counts. */
function replay(progress: Progress, held: Progress["held"]): Progress {
  return held ? afterState(progress, held.state) : progress;
}

const KNOWN_STATES = new Set(["cleaning", "docked", "idle", "paused", "returning", "error"]);

function afterState(progress: Progress, state: string | undefined): Progress {
  const { phase, held } = progress;
  switch (phase) {
    case "done":
    case "failed":
    case "not_started":
      return progress;
    case "sending":
      if (held && held.state === state) return progress;
      return { phase, statusUnknown: !isKnown(state), held: { state } };
    case "starting":
    case "cleaning":
    case "paused":
    case "may_have_started":
      return isKnown(state) ? moved(progress, phaseOn(phase, state)) : flagged(progress);
  }
}

function isKnown(state: string | undefined): state is string {
  return state !== undefined && KNOWN_STATES.has(state);
}

function flagged(progress: Progress): Progress {
  return progress.statusUnknown ? progress : { ...progress, statusUnknown: true };
}

function moved(progress: Progress, phase: ProgressPhase): Progress {
  if (phase === progress.phase) return progress.statusUnknown ? { ...progress, statusUnknown: false } : progress;
  return { phase, statusUnknown: false };
}

/** The row of « Progress on a room » a known vacuum state gives while the job may be under way. */
function phaseOn(phase: "starting" | "cleaning" | "paused" | "may_have_started", state: string): ProgressPhase {
  switch (state) {
    case "cleaning":
      return "cleaning";
    case "paused":
      return "paused";
    case "error":
      return "failed";
    default:
      // `returning`, `docked`, `idle`: the end of a job under way; before it started, nothing to read yet.
      return phase === "cleaning" || phase === "paused" ? "done" : phase;
  }
}
