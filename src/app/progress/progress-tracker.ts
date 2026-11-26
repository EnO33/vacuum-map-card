import type { CleanError } from "../../domain/clean/clean-error";
import {
  nextProgress,
  type Progress,
  type ProgressEvent,
  type ProgressPhase,
  SENDING,
} from "../../domain/clean/progress";
import { compareCodeUnits } from "../../domain/text/compare";
import { Listeners } from "../listeners";
import type { HassPort } from "../ports/hass-port";
import type { ItemRef } from "../robots-for-item/robots-for-item";
import type { CleanController } from "../start-clean/clean-controller";

/** One robot's progress on the item it was sent to. Values only: no map id, segment id or service call data. */
export interface ProgressEntry {
  readonly vacuumEntityId: string;
  readonly item: ItemRef;
  readonly phase: ProgressPhase;
  readonly error?: CleanError;
  readonly statusUnknown: boolean;
}

export type ProgressController = Pick<CleanController, "onSending" | "onOutcome" | "acknowledge">;

export interface ProgressTracker {
  /** Called by the card on each model update; reads only tracked robots and feeds a state only when it changed. */
  observe(hass: Pick<HassPort, "vacuum">): void;
  /**
   * Every entry, by vacuum entity id; the same array while nothing changed. An entry keeps its identity until its
   * phase, error or status changes, so a caller tells a changed entry by reference.
   */
  entries(): readonly ProgressEntry[];
  /**
   * Tells of each change a start or a dismiss makes; a change read from the vacuum states is the caller's of `observe`.
   * Returns the remover.
   */
  subscribe(listener: () => void): () => void;
  /** Removes the robot's entry and acknowledges its outcome on the controller that stored it. */
  dismiss(vacuumEntityId: string): void;
  /**
   * Follows a controller's starts; returns the function that stops following it. Entries already shown stay, and a
   * start in flight on a controller no longer followed still gets its outcome, so nothing is lost while the card is
   * away from the page and comes back with a new controller.
   */
  follow(controller: ProgressController): () => void;
}

interface Start {
  /** The controller that sent the start: it stores its outcome until acknowledged. */
  readonly controller: ProgressController;
  progress: Progress;
  /** What the start shows; keeps its identity unless that changed. */
  entry: ProgressEntry;
}

const NONE: readonly ProgressEntry[] = Object.freeze([]);

/**
 * Progress per robot in memory only (ADR 0003 « Amendment (2026-11-24) », « Progress on a room »): no timer, no
 * polling, no storage, so a reload starts empty. A start begins when a followed controller sends (`onSending`), so an
 * answer that sends nothing never touches the progress; a new start for a robot replaces its entry.
 */
export function createProgressTracker(): ProgressTracker {
  const shown = new Map<string, Start>();
  const lastState = new Map<string, string | undefined>();
  /** Every entry, rebuilt only after a change; `undefined` until then. */
  let all: readonly ProgressEntry[] | undefined = NONE;
  const changes = new Listeners();
  const changed = (): void => {
    all = undefined;
    changes.notify();
  };

  /** Robots dismissed while their call was in flight, by the controller sending it: acknowledged when it answers. */
  const dismissedSending = new Map<string, ProgressController>();

  const follow = (controller: ProgressController): (() => void) => {
    const stopSending = controller.onSending(({ vacuumEntityId, item, vacuumState }) => {
      const progress = nextProgress(SENDING, { kind: "confirm_started", state: vacuumState });
      shown.set(vacuumEntityId, { controller, progress, entry: entryOf(vacuumEntityId, item, progress) });
      // The state before the start is the baseline: a robot already in `error` or `cleaning` is read once it changes.
      lastState.set(vacuumEntityId, vacuumState);
      dismissedSending.delete(vacuumEntityId);
      changed();
    });
    // Kept after `stopSending`: a call in flight still answers, and its outcome still belongs to its start.
    controller.onOutcome((vacuumEntityId, outcome) => {
      if (dismissedSending.get(vacuumEntityId) === controller) {
        dismissedSending.delete(vacuumEntityId);
        controller.acknowledge(vacuumEntityId);
      }
      const start = shown.get(vacuumEntityId);
      if (start?.controller === controller && apply(start, { kind: "outcome", outcome })) changed();
    });
    return stopSending;
  };

  return {
    observe(hass) {
      for (const [vacuumEntityId, start] of shown) {
        const state = hass.vacuum(vacuumEntityId)?.state;
        if (lastState.has(vacuumEntityId) && lastState.get(vacuumEntityId) === state) continue;
        lastState.set(vacuumEntityId, state);
        // Read by the caller of `observe` through `entries`, not told to the listeners.
        if (apply(start, { kind: "vacuum_state", state })) all = undefined;
      }
    },
    entries() {
      all ??= sortedEntries(shown);
      return all;
    },
    subscribe: (listener) => changes.add(listener),
    dismiss(vacuumEntityId) {
      const start = shown.get(vacuumEntityId);
      if (start === undefined) return;
      if (start.progress.phase === "sending") dismissedSending.set(vacuumEntityId, start.controller);
      shown.delete(vacuumEntityId);
      lastState.delete(vacuumEntityId);
      start.controller.acknowledge(vacuumEntityId);
      changed();
    },
    follow,
  };
}

/** Every start's entry, by vacuum entity id. */
function sortedEntries(shown: ReadonlyMap<string, Start>): readonly ProgressEntry[] {
  const entries = [...shown.values()].map((start) => start.entry);
  return entries.length === 0 ? NONE : entries.sort((a, b) => compareCodeUnits(a.vacuumEntityId, b.vacuumEntityId));
}

/** Applies an event; `true` when what the start shows changed. */
function apply(start: Start, event: ProgressEvent): boolean {
  const next = nextProgress(start.progress, event);
  if (next === start.progress) return false;
  start.progress = next;
  const { entry } = start;
  if (entry.phase === next.phase && entry.error === next.error && entry.statusUnknown === next.statusUnknown)
    return false;
  start.entry = entryOf(entry.vacuumEntityId, entry.item, next);
  return true;
}

function entryOf(vacuumEntityId: string, item: ItemRef, { phase, error, statusUnknown }: Progress): ProgressEntry {
  return error ? { vacuumEntityId, item, phase, error, statusUnknown } : { vacuumEntityId, item, phase, statusUnknown };
}
