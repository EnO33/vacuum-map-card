// Fakes for the progress of a started room (`src/app/progress/`): a controller the test drives, and vacuum states.

import type { HassPort } from "../../src/app/ports/hass-port";
import type { ProgressController, ProgressEntry, ProgressTracker } from "../../src/app/progress/progress-tracker";
import type { ItemRef } from "../../src/app/robots-for-item/robots-for-item";
import type { OutcomeListener, SendingListener, StoredOutcome } from "../../src/app/start-clean/outcomes";

/** `send` and `answer` stand for a confirm that goes on to the call and its stored outcome. */
export class FakeProgressController implements ProgressController {
  readonly acknowledged: string[] = [];
  readonly #sending = new Set<SendingListener>();
  readonly #outcome = new Set<OutcomeListener>();
  onSending(listener: SendingListener) {
    this.#sending.add(listener);
    return () => this.#sending.delete(listener);
  }
  onOutcome(listener: OutcomeListener) {
    this.#outcome.add(listener);
    return () => this.#outcome.delete(listener);
  }
  acknowledge(vacuumEntityId: string): void {
    this.acknowledged.push(vacuumEntityId);
  }
  send(vacuumEntityId: string, item: ItemRef, vacuumState: string | undefined = "docked"): void {
    for (const listener of this.#sending) listener({ vacuumEntityId, item, vacuumState });
  }
  answer(vacuumEntityId: string, outcome: StoredOutcome): void {
    for (const listener of this.#outcome) listener(vacuumEntityId, outcome);
  }
  started(vacuumEntityId: string, item: ItemRef, outcome: StoredOutcome = { kind: "accepted" }): void {
    this.send(vacuumEntityId, item);
    this.answer(vacuumEntityId, outcome);
  }
}

/** Vacuum states the test sets, counting reads; only `vacuum` of the port. */
export class FakeVacuumStates implements Pick<HassPort, "vacuum"> {
  readonly #states = new Map<string, string>();
  reads = 0;
  set(entityId: string, state: string | undefined): this {
    if (state === undefined) this.#states.delete(entityId);
    else this.#states.set(entityId, state);
    return this;
  }
  vacuum(entityId: string) {
    this.reads += 1;
    const state = this.#states.get(entityId);
    return state === undefined ? undefined : { state, supportedFeatures: 0 };
  }
}

/** The tracker's entries on one item, as the card picks them out of `entries()`; a new array on each call. */
export function entriesOn(tracker: Pick<ProgressTracker, "entries">, item: ItemRef): ProgressEntry[] {
  const id = (ref: ItemRef) =>
    [ref.kind, ref.imageEntityId, ref.kind === "room" ? ref.regionId : ref.areaId].join("\n");
  return tracker.entries().filter((entry) => id(entry.item) === id(item));
}
