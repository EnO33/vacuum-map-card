import { createFloorModelBuilder } from "../floor-model/memo";
import { sameValue } from "../floor-model/same-value";
import type { HassPort } from "../ports/hass-port";
import type { RoomSource } from "../ports/room-source";
import type { ServiceCall, ServiceResult } from "../ports/service-call";
import type { ItemRef } from "../robots-for-item/robots-for-item";
import { sourcedRobots } from "../robots-for-item/source-robots";
import { classifyCleanError, type ErrorSource } from "./classify-error";
import { type Intent, intentOf, type PrepareResult } from "./intent";
import type { ConfirmOutcome, OutcomeListener, SendingListener, StoredOutcome } from "./outcomes";

export interface CleanControllerDeps {
  /** Reads the live `hass` on every call (not a snapshot), so the re-check sees the current state. */
  readonly hass: HassPort;
  /** The room sources as they are now. */
  readonly sources: () => readonly RoomSource[];
}

export interface CleanController {
  /** Captures the intent when the dialog opens. Sends nothing. */
  prepare(item: ItemRef, vacuumEntityId: string): PrepareResult;
  /**
   * Re-checks the intent against the current state and sends exactly one call, or nothing. Takes the very object
   * `prepare` returned: one send per intent object, never a retry.
   */
  confirm(intent: Intent): Promise<ConfirmOutcome>;
  /** Discards an intent that was not confirmed; after confirming, it changes nothing. */
  dismiss(intent: Intent): void;
  outcomeOf(vacuumEntityId: string): StoredOutcome | undefined;
  acknowledge(vacuumEntityId: string): void;
  /** Returns the function that removes the listener. Outcomes stay stored with no listener. */
  onOutcome(listener: OutcomeListener): () => void;
  /**
   * Called in the caller's task when a `confirm` goes on to the re-check and the call; never for an answer that sends
   * nothing (`busy`, `already_sent`, `discarded`). Its outcome follows through `onOutcome`. Returns the remover.
   */
  onSending(listener: SendingListener): () => void;
}

/**
 * The controller behind the confirmation dialog (ADR 0003 « Confirmation », « When the checks run »): one send per
 * confirmation, never a retry or a path switch; outcomes kept per robot, whatever happens to the dialog.
 */
export function createCleanController({ hass, sources }: CleanControllerDeps): CleanController {
  const buildModel = createFloorModelBuilder();
  const prepare = (item: ItemRef, vacuumEntityId: string) => {
    const now = sources();
    return intentOf(buildModel(hass, now), item, vacuumEntityId, hass, now);
  };
  const consumed = new WeakSet<Intent>();
  const dismissed = new WeakSet<Intent>();
  const inFlight = new Set<string>();
  const outcomes = new Map<string, StoredOutcome>();
  const listeners = new Set<OutcomeListener>();
  const sendingListeners = new Set<SendingListener>();
  /** The re-check is synchronous, before the call's `await`; the call is built from the re-derived intent. */
  const send = async (intent: Intent): Promise<StoredOutcome> => {
    const now = prepare(intent.item, intent.vacuumEntityId);
    if (now.kind !== "intent" || !sameValue(now.intent, intent)) return { kind: "changed" };
    const errorSource = errorSourceOf(sources(), intent.vacuumEntityId);
    let result: ServiceResult;
    try {
      result = await hass.callService(callOf(now.intent));
    } catch {
      return startedMaybe();
    }
    if (result.ok) return { kind: "accepted" };
    try {
      return {
        kind: "error",
        error: classifyCleanError(result.error, { path: intent.path.path, source: errorSource }),
      };
    } catch {
      return startedMaybe();
    }
  };

  return {
    prepare,
    confirm(intent) {
      // Everything up to the first `await` runs in the caller's task: a second confirm in the same task is refused.
      if (dismissed.has(intent)) return Promise.resolve({ kind: "discarded" });
      if (consumed.has(intent)) return Promise.resolve({ kind: "already_sent" });
      const id = intent.vacuumEntityId;
      if (inFlight.has(id)) return Promise.resolve({ kind: "busy" });
      consumed.add(intent);
      inFlight.add(id);
      notify(sendingListeners, (listener) => listener(intent));
      // `send` catches every failure from the call on; one here happened before anything was sent.
      return send(intent)
        .catch((): StoredOutcome => ({ kind: "changed" }))
        .then((outcome) => {
          outcomes.set(id, outcome);
          inFlight.delete(id);
          notify(listeners, (listener) => listener(id, outcome));
          return outcome;
        });
    },
    dismiss(intent) {
      if (!consumed.has(intent)) dismissed.add(intent);
    },
    outcomeOf: (vacuumEntityId) => outcomes.get(vacuumEntityId),
    acknowledge(vacuumEntityId) {
      outcomes.delete(vacuumEntityId);
    },
    onOutcome(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onSending(listener) {
      sendingListeners.add(listener);
      return () => sendingListeners.delete(listener);
    },
  };
}

/** A failing listener never hides the news from the others; an outcome stays stored. */
function notify<L>(listeners: ReadonlySet<L>, call: (listener: L) => void): void {
  for (const listener of listeners) {
    try {
      call(listener);
    } catch {
      // Ignored: see above.
    }
  }
}

/** Path 1: one robot, one area (ADR 0003 « Path 1 », « Call »); path 2: the adapter's call as captured. */
function callOf(intent: Intent): ServiceCall {
  if (intent.path.path === 2) return intent.path.call;
  return {
    domain: "vacuum",
    service: "clean_area",
    data: { cleaning_area_id: [intent.path.areaId] },
    target: { entity_id: intent.vacuumEntityId },
  };
}

/** The robot's own source; with none, no integration domain is recognised and every error is unknown. */
function errorSourceOf(sources: readonly RoomSource[], vacuumEntityId: string): ErrorSource {
  const sourced = sourcedRobots(sources).get(vacuumEntityId);
  if (!sourced) return { integration: "", classifyError: () => undefined };
  const { source, robot } = sourced;
  return { integration: source.integration, classifyError: (error) => robot.classifyError(error) };
}

/** Something failed after the call may have been sent: unknown, possibly started. */
function startedMaybe(): StoredOutcome {
  return { kind: "error", error: { kind: "unknown", mayHaveStarted: "unknown" } };
}
