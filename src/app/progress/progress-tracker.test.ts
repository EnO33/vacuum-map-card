import { describe, expect, it } from "vitest";
import type { CleanError } from "../../domain/clean/clean-error";
import type { HassPort } from "../ports/hass-port";
import type { ItemRef } from "../robots-for-item/robots-for-item";
import type { Intent } from "../start-clean/intent";
import type { OutcomeListener, SendingListener, StoredOutcome } from "../start-clean/outcomes";
import { createProgressTracker, type ProgressController } from "./progress-tracker";

const kitchen: ItemRef = { kind: "room", imageEntityId: "image.robot_one_rooms_map", regionId: "1" };
const hall: ItemRef = { kind: "area", imageEntityId: "image.robot_one_floor_plan_a", areaId: "hall" };
const notLinked: CleanError = { kind: "rooms_not_linked", mayHaveStarted: "no" };

function intentFor(vacuumEntityId: string, item: ItemRef): Intent {
  return {
    vacuumEntityId,
    action: "vacuum",
    item,
    path: { path: 1, areaId: "hall", roomNames: ["Hall"], mapId: "map", segments: [] },
  };
}

/** A controller the test drives: `send` and `answer` stand for a confirm that sends and its stored outcome. */
class FakeController implements ProgressController {
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
  send(intent: Intent): void {
    for (const listener of this.#sending) listener(intent);
  }
  answer(vacuumEntityId: string, outcome: StoredOutcome): void {
    for (const listener of this.#outcome) listener(vacuumEntityId, outcome);
  }
  started(intent: Intent, outcome: StoredOutcome = { kind: "accepted" }): void {
    this.send(intent);
    this.answer(intent.vacuumEntityId, outcome);
  }
}

/** Vacuum states the test sets; the tracker reads only `vacuum`. */
class States implements Pick<HassPort, "vacuum"> {
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

function setup() {
  const controller = new FakeController();
  const tracker = createProgressTracker(controller);
  const states = new States().set("vacuum.one", "docked").set("vacuum.two", "docked");
  return { controller, tracker, states };
}

const phases = (entries: readonly { readonly phase: string }[]) => entries.map((e) => e.phase);

describe("createProgressTracker", () => {
  it("is empty when created: nothing is kept across a reload", () => {
    const { tracker } = setup();
    expect(tracker.forItem(kitchen)).toEqual([]);
  });

  it("shows sending on the item while the call runs, then starting once accepted", () => {
    const { tracker, controller } = setup();
    controller.send(intentFor("vacuum.one", kitchen));
    expect(tracker.forItem(kitchen)).toEqual([
      { vacuumEntityId: "vacuum.one", item: kitchen, phase: "sending", statusUnknown: false },
    ]);
    controller.answer("vacuum.one", { kind: "accepted" });
    expect(phases(tracker.forItem(kitchen))).toEqual(["starting"]);
    expect(tracker.forItem(hall)).toEqual([]);
  });

  it("follows the vacuum states the card observes", () => {
    const { tracker, controller, states } = setup();
    tracker.observe(states);
    controller.started(intentFor("vacuum.one", kitchen));
    tracker.observe(states.set("vacuum.one", "cleaning"));
    expect(phases(tracker.forItem(kitchen))).toEqual(["cleaning"]);
    tracker.observe(states.set("vacuum.one", "unavailable"));
    expect(tracker.forItem(kitchen)).toMatchObject([{ phase: "cleaning", statusUnknown: true }]);
    tracker.observe(states.set("vacuum.one", "returning"));
    expect(tracker.forItem(kitchen)).toMatchObject([{ phase: "done", statusUnknown: false }]);
  });

  it("applies a state reported while sending once the call is accepted", () => {
    const { tracker, controller, states } = setup();
    controller.send(intentFor("vacuum.one", kitchen));
    tracker.observe(states.set("vacuum.one", "cleaning"));
    controller.answer("vacuum.one", { kind: "accepted" });
    expect(phases(tracker.forItem(kitchen))).toEqual(["cleaning"]);
  });

  it("counts the first state a new start sees, even when the robot's state string did not change", () => {
    const { tracker, controller, states } = setup();
    controller.started(intentFor("vacuum.one", kitchen));
    tracker.observe(states.set("vacuum.one", "cleaning"));
    controller.send(intentFor("vacuum.one", hall));
    tracker.observe(states);
    controller.answer("vacuum.one", { kind: "accepted" });
    expect(phases(tracker.forItem(hall))).toEqual(["cleaning"]);
  });

  it("flags status unknown when the vacuum leaves the states", () => {
    const { tracker, controller, states } = setup();
    controller.started(intentFor("vacuum.one", kitchen));
    tracker.observe(states.set("vacuum.one", undefined));
    expect(tracker.forItem(kitchen)).toMatchObject([{ phase: "starting", statusUnknown: true }]);
  });

  it("keeps the error of a refused start, and only the item, phase and error", () => {
    const { tracker, controller } = setup();
    controller.started(intentFor("vacuum.one", kitchen), { kind: "error", error: notLinked });
    const [entry] = tracker.forItem(kitchen);
    expect(entry).toEqual({
      vacuumEntityId: "vacuum.one",
      item: kitchen,
      phase: "failed",
      error: notLinked,
      statusUnknown: false,
    });
    expect(Object.keys(entry?.item ?? {}).sort()).toEqual(["imageEntityId", "kind", "regionId"]);
  });

  it("shows not started on a changed outcome", () => {
    const { tracker, controller } = setup();
    controller.started(intentFor("vacuum.one", kitchen), { kind: "changed" });
    expect(phases(tracker.forItem(kitchen))).toEqual(["not_started"]);
  });

  it("lists every robot sent to the item, by vacuum entity id", () => {
    const { tracker, controller } = setup();
    controller.started(intentFor("vacuum.two", kitchen));
    controller.started(intentFor("vacuum.one", kitchen), { kind: "changed" });
    expect(tracker.forItem(kitchen).map((e) => [e.vacuumEntityId, e.phase])).toEqual([
      ["vacuum.one", "not_started"],
      ["vacuum.two", "starting"],
    ]);
  });

  it("replaces a robot's entry with its new start", () => {
    const { tracker, controller } = setup();
    controller.started(intentFor("vacuum.one", kitchen));
    controller.started(intentFor("vacuum.one", hall), { kind: "changed" });
    expect(tracker.forItem(kitchen)).toEqual([]);
    expect(phases(tracker.forItem(hall))).toEqual(["not_started"]);
  });

  it("ignores an outcome for a robot it does not track", () => {
    const { tracker, controller } = setup();
    controller.answer("vacuum.one", { kind: "accepted" });
    expect(tracker.forItem(kitchen)).toEqual([]);
  });

  describe("observe", () => {
    it("feeds a robot's state only when its string changed", () => {
      const { tracker, controller, states } = setup();
      controller.started(intentFor("vacuum.one", kitchen));
      tracker.observe(states.set("vacuum.one", "cleaning"));
      tracker.observe(states.set("vacuum.one", "paused"));
      const paused = tracker.forItem(kitchen);
      tracker.observe(states);
      expect(tracker.forItem(kitchen)).toBe(paused);
      expect(phases(paused)).toEqual(["paused"]);
    });

    it("reads only tracked robots", () => {
      const { tracker, states } = setup();
      tracker.observe(states);
      expect(states.reads).toBe(0);
    });
  });

  describe("identity", () => {
    it("returns the same array while nothing changed for the item", () => {
      const { tracker, controller, states } = setup();
      controller.started(intentFor("vacuum.one", kitchen));
      controller.started(intentFor("vacuum.two", hall));
      const before = tracker.forItem(kitchen);
      expect(tracker.forItem(kitchen)).toBe(before);
      tracker.observe(states.set("vacuum.two", "cleaning"));
      expect(tracker.forItem(kitchen)).toBe(before);
      tracker.observe(states.set("vacuum.one", "cleaning"));
      expect(tracker.forItem(kitchen)).not.toBe(before);
    });

    it("keeps the array when only a state held while sending changed", () => {
      const { tracker, controller, states } = setup();
      controller.send(intentFor("vacuum.one", kitchen));
      const sending = tracker.forItem(kitchen);
      tracker.observe(states.set("vacuum.one", "docked"));
      tracker.observe(states.set("vacuum.one", "idle"));
      expect(tracker.forItem(kitchen)).toBe(sending);
    });

    it("returns the same empty array for items without progress", () => {
      const { tracker, controller } = setup();
      expect(tracker.forItem(kitchen)).toBe(tracker.forItem(hall));
      controller.started(intentFor("vacuum.one", kitchen));
      expect(tracker.forItem(hall)).toEqual([]);
      expect(tracker.forItem(hall)).toBe(tracker.forItem(hall));
    });
  });

  describe("dismiss", () => {
    it("removes the entry and acknowledges the outcome", () => {
      const { tracker, controller } = setup();
      controller.started(intentFor("vacuum.one", kitchen));
      tracker.dismiss("vacuum.one");
      expect(tracker.forItem(kitchen)).toEqual([]);
      expect(controller.acknowledged).toEqual(["vacuum.one"]);
    });

    it("ignores the late outcome of a dismissed start", () => {
      const { tracker, controller } = setup();
      controller.send(intentFor("vacuum.one", kitchen));
      tracker.dismiss("vacuum.one");
      controller.answer("vacuum.one", { kind: "accepted" });
      expect(tracker.forItem(kitchen)).toEqual([]);
    });
  });

  it("stops listening once closed", () => {
    const { tracker, controller } = setup();
    tracker.close();
    controller.started(intentFor("vacuum.one", kitchen));
    expect(tracker.forItem(kitchen)).toEqual([]);
  });
});
