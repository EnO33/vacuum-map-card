import type { CleanError } from "../../domain/clean/clean-error";
import {
  nextProgress,
  type Progress,
  type ProgressEvent,
  type ProgressPhase,
  SENDING,
} from "../../domain/clean/progress";
import { compareCodeUnits } from "../../domain/text/compare";
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
  /** The entries on the item, by vacuum entity id; the same array while nothing changed for that item. */
  forItem(item: ItemRef): readonly ProgressEntry[];
  /** Removes the robot's entry and acknowledges its outcome. */
  dismiss(vacuumEntityId: string): void;
  /** Stops listening to the controller. */
  close(): void;
}

interface Start {
  readonly key: string;
  progress: Progress;
  /** What the start shows; keeps its identity unless that changed. */
  entry: ProgressEntry;
}

const NONE: readonly ProgressEntry[] = Object.freeze([]);

/**
 * Progress per robot in memory only (ADR 0003 « Amendment (2026-11-24) », « Progress on a room »): no timer, no
 * polling, no storage, so a reload starts empty. A start begins when the controller sends (`onSending`), so an answer
 * that sends nothing never touches the progress; a new start for a robot replaces its entry.
 */
export function createProgressTracker(controller: ProgressController): ProgressTracker {
  const shown = new Map<string, Start>();
  const lastState = new Map<string, string | undefined>();
  const lists = new Map<string, readonly ProgressEntry[]>();

  /** Robots dismissed while their call was in flight: their outcome is acknowledged when it comes. */
  const dismissedSending = new Set<string>();

  const stopSending = controller.onSending(({ vacuumEntityId, item, vacuumState }) => {
    const progress = nextProgress(SENDING, { kind: "confirm_started", state: vacuumState });
    shown.set(vacuumEntityId, { key: keyOf(item), progress, entry: entryOf(vacuumEntityId, item, progress) });
    // The state before the start is the baseline: a robot already in `error` or `cleaning` is read only once it changes.
    lastState.set(vacuumEntityId, vacuumState);
    dismissedSending.delete(vacuumEntityId);
  });
  const stopOutcome = controller.onOutcome((vacuumEntityId, outcome) => {
    if (dismissedSending.delete(vacuumEntityId)) controller.acknowledge(vacuumEntityId);
    const start = shown.get(vacuumEntityId);
    if (start) apply(start, { kind: "outcome", outcome });
  });

  return {
    observe(hass) {
      for (const [vacuumEntityId, start] of shown) {
        const state = hass.vacuum(vacuumEntityId)?.state;
        if (lastState.has(vacuumEntityId) && lastState.get(vacuumEntityId) === state) continue;
        lastState.set(vacuumEntityId, state);
        apply(start, { kind: "vacuum_state", state });
      }
    },
    forItem(item) {
      if (shown.size === 0) return NONE;
      return listFor(shown, lists, keyOf(item));
    },
    dismiss(vacuumEntityId) {
      if (shown.get(vacuumEntityId)?.progress.phase === "sending") dismissedSending.add(vacuumEntityId);
      shown.delete(vacuumEntityId);
      lastState.delete(vacuumEntityId);
      controller.acknowledge(vacuumEntityId);
    },
    close() {
      stopSending();
      stopOutcome();
    },
  };
}

/** The item's entries; the cached array while they are the same objects. */
function listFor(
  shown: ReadonlyMap<string, Start>,
  lists: Map<string, readonly ProgressEntry[]>,
  key: string,
): readonly ProgressEntry[] {
  const entries = [...shown.values()]
    .filter((start) => start.key === key)
    .map((start) => start.entry)
    .sort((a, b) => compareCodeUnits(a.vacuumEntityId, b.vacuumEntityId));
  if (entries.length === 0) {
    lists.delete(key);
    return NONE;
  }
  const cached = lists.get(key);
  if (cached && cached.length === entries.length && cached.every((entry, i) => entry === entries[i])) return cached;
  lists.set(key, entries);
  return entries;
}

function apply(start: Start, event: ProgressEvent): void {
  const next = nextProgress(start.progress, event);
  if (next === start.progress) return;
  start.progress = next;
  const { entry } = start;
  if (entry.phase === next.phase && entry.error === next.error && entry.statusUnknown === next.statusUnknown) return;
  start.entry = entryOf(entry.vacuumEntityId, entry.item, next);
}

function entryOf(vacuumEntityId: string, item: ItemRef, { phase, error, statusUnknown }: Progress): ProgressEntry {
  return error ? { vacuumEntityId, item, phase, error, statusUnknown } : { vacuumEntityId, item, phase, statusUnknown };
}

function keyOf(item: ItemRef): string {
  return JSON.stringify([item.kind, item.imageEntityId, item.kind === "room" ? item.regionId : item.areaId]);
}
