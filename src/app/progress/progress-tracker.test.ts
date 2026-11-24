import { describe, expect, it } from "vitest";
import { FakeProgressController, FakeVacuumStates } from "../../../test/fakes/fake-progress";
import type { CleanError } from "../../domain/clean/clean-error";
import type { ItemRef } from "../robots-for-item/robots-for-item";
import { createProgressTracker } from "./progress-tracker";

const kitchen: ItemRef = { kind: "room", imageEntityId: "image.robot_one_rooms_map", regionId: "1" };
const hall: ItemRef = { kind: "area", imageEntityId: "image.robot_one_floor_plan_a", areaId: "hall" };
const notLinked: CleanError = { kind: "rooms_not_linked", mayHaveStarted: "no" };

function setup() {
  const controller = new FakeProgressController();
  const tracker = createProgressTracker(controller);
  const states = new FakeVacuumStates().set("vacuum.one", "docked").set("vacuum.two", "docked");
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
    controller.send("vacuum.one", kitchen);
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
    controller.started("vacuum.one", kitchen);
    tracker.observe(states.set("vacuum.one", "cleaning"));
    expect(phases(tracker.forItem(kitchen))).toEqual(["cleaning"]);
    tracker.observe(states.set("vacuum.one", "unavailable"));
    expect(tracker.forItem(kitchen)).toMatchObject([{ phase: "cleaning", statusUnknown: true }]);
    tracker.observe(states.set("vacuum.one", "returning"));
    expect(tracker.forItem(kitchen)).toMatchObject([{ phase: "done", statusUnknown: false }]);
  });

  it("applies a state reported while sending once the call is accepted", () => {
    const { tracker, controller, states } = setup();
    controller.send("vacuum.one", kitchen);
    tracker.observe(states.set("vacuum.one", "cleaning"));
    controller.answer("vacuum.one", { kind: "accepted" });
    expect(phases(tracker.forItem(kitchen))).toEqual(["cleaning"]);
  });

  it.each(["error", "cleaning", "paused"])(
    "reads a robot that was %s at the confirm only once its state changes",
    (was) => {
      const { tracker, controller, states } = setup();
      states.set("vacuum.one", was);
      controller.send("vacuum.one", kitchen, was);
      tracker.observe(states);
      controller.answer("vacuum.one", { kind: "accepted" });
      tracker.observe(states);
      expect(phases(tracker.forItem(kitchen))).toEqual(["starting"]);
      tracker.observe(states.set("vacuum.one", "docked"));
      tracker.observe(states.set("vacuum.one", "cleaning"));
      expect(phases(tracker.forItem(kitchen))).toEqual(["cleaning"]);
    },
  );

  it("flags status unknown from a confirm while the state is unknown", () => {
    const { tracker, controller } = setup();
    controller.send("vacuum.one", kitchen, "unknown");
    controller.answer("vacuum.one", { kind: "accepted" });
    expect(tracker.forItem(kitchen)).toMatchObject([{ phase: "starting", statusUnknown: true }]);
  });

  it("flags status unknown when the vacuum leaves the states", () => {
    const { tracker, controller, states } = setup();
    controller.started("vacuum.one", kitchen);
    tracker.observe(states.set("vacuum.one", undefined));
    expect(tracker.forItem(kitchen)).toMatchObject([{ phase: "starting", statusUnknown: true }]);
  });

  it("keeps the error of a refused start, and only the item, phase and error", () => {
    const { tracker, controller } = setup();
    controller.started("vacuum.one", kitchen, { kind: "error", error: notLinked });
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
    controller.started("vacuum.one", kitchen, { kind: "changed" });
    expect(phases(tracker.forItem(kitchen))).toEqual(["not_started"]);
  });

  it("lists every robot sent to the item, by vacuum entity id", () => {
    const { tracker, controller } = setup();
    controller.started("vacuum.two", kitchen);
    controller.started("vacuum.one", kitchen, { kind: "changed" });
    expect(tracker.forItem(kitchen).map((e) => [e.vacuumEntityId, e.phase])).toEqual([
      ["vacuum.one", "not_started"],
      ["vacuum.two", "starting"],
    ]);
  });

  it("replaces a robot's entry with its new start", () => {
    const { tracker, controller } = setup();
    controller.started("vacuum.one", kitchen);
    controller.started("vacuum.one", hall, { kind: "changed" });
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
      controller.started("vacuum.one", kitchen);
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
      controller.started("vacuum.one", kitchen);
      controller.started("vacuum.two", hall);
      const before = tracker.forItem(kitchen);
      expect(tracker.forItem(kitchen)).toBe(before);
      tracker.observe(states.set("vacuum.two", "cleaning"));
      expect(tracker.forItem(kitchen)).toBe(before);
      tracker.observe(states.set("vacuum.one", "cleaning"));
      expect(tracker.forItem(kitchen)).not.toBe(before);
    });

    it("keeps the array when only a state held while sending changed", () => {
      const { tracker, controller, states } = setup();
      controller.send("vacuum.one", kitchen);
      const sending = tracker.forItem(kitchen);
      tracker.observe(states.set("vacuum.one", "docked"));
      tracker.observe(states.set("vacuum.one", "idle"));
      expect(tracker.forItem(kitchen)).toBe(sending);
    });

    it("returns the same empty array for items without progress", () => {
      const { tracker, controller } = setup();
      expect(tracker.forItem(kitchen)).toBe(tracker.forItem(hall));
      controller.started("vacuum.one", kitchen);
      expect(tracker.forItem(hall)).toEqual([]);
      expect(tracker.forItem(hall)).toBe(tracker.forItem(hall));
    });
  });

  describe("dismiss", () => {
    it("removes the entry and acknowledges the outcome", () => {
      const { tracker, controller } = setup();
      controller.started("vacuum.one", kitchen);
      tracker.dismiss("vacuum.one");
      expect(tracker.forItem(kitchen)).toEqual([]);
      expect(controller.acknowledged).toEqual(["vacuum.one"]);
    });

    it("ignores the late outcome of a start dismissed while sending, and acknowledges it", () => {
      const { tracker, controller } = setup();
      controller.send("vacuum.one", kitchen);
      tracker.dismiss("vacuum.one");
      expect(controller.acknowledged).toEqual(["vacuum.one"]);
      controller.answer("vacuum.one", { kind: "accepted" });
      expect(tracker.forItem(kitchen)).toEqual([]);
      expect(controller.acknowledged).toEqual(["vacuum.one", "vacuum.one"]);
      controller.started("vacuum.one", hall);
      expect(controller.acknowledged).toHaveLength(2);
      expect(phases(tracker.forItem(hall))).toEqual(["starting"]);
    });
  });

  it("stops listening once closed", () => {
    const { tracker, controller } = setup();
    tracker.close();
    controller.started("vacuum.one", kitchen);
    expect(tracker.forItem(kitchen)).toEqual([]);
  });
});
