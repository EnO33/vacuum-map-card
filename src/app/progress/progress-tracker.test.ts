import { describe, expect, it } from "vitest";
import { entriesOn, FakeProgressController, FakeVacuumStates } from "../../../test/fakes/fake-progress";
import type { CleanError } from "../../domain/clean/clean-error";
import type { ItemRef } from "../robots-for-item/robots-for-item";
import { createProgressTracker } from "./progress-tracker";

const kitchen: ItemRef = { kind: "room", imageEntityId: "image.robot_one_rooms_map", regionId: "1" };
const hall: ItemRef = { kind: "area", imageEntityId: "image.robot_one_floor_plan_a", areaId: "hall" };
const notLinked: CleanError = { kind: "rooms_not_linked", mayHaveStarted: "no" };

function setup() {
  const controller = new FakeProgressController();
  const tracker = createProgressTracker();
  const stopFollowing = tracker.follow(controller);
  const states = new FakeVacuumStates().set("vacuum.one", "docked").set("vacuum.two", "docked");
  return { controller, tracker, states, stopFollowing };
}

const phases = (entries: readonly { readonly phase: string }[]) => entries.map((e) => e.phase);

describe("createProgressTracker", () => {
  it("is empty when created: nothing is kept across a reload", () => {
    const { tracker } = setup();
    expect(entriesOn(tracker, kitchen)).toEqual([]);
  });

  it("shows sending on the item while the call runs, then starting once accepted", () => {
    const { tracker, controller } = setup();
    controller.send("vacuum.one", kitchen);
    expect(entriesOn(tracker, kitchen)).toEqual([
      { vacuumEntityId: "vacuum.one", item: kitchen, phase: "sending", statusUnknown: false },
    ]);
    controller.answer("vacuum.one", { kind: "accepted" });
    expect(phases(entriesOn(tracker, kitchen))).toEqual(["starting"]);
    expect(entriesOn(tracker, hall)).toEqual([]);
  });

  it("follows the vacuum states the card observes", () => {
    const { tracker, controller, states } = setup();
    tracker.observe(states);
    controller.started("vacuum.one", kitchen);
    tracker.observe(states.set("vacuum.one", "cleaning"));
    expect(phases(entriesOn(tracker, kitchen))).toEqual(["cleaning"]);
    tracker.observe(states.set("vacuum.one", "unavailable"));
    expect(entriesOn(tracker, kitchen)).toMatchObject([{ phase: "cleaning", statusUnknown: true }]);
    tracker.observe(states.set("vacuum.one", "returning"));
    expect(entriesOn(tracker, kitchen)).toMatchObject([{ phase: "done", statusUnknown: false }]);
  });

  it("applies a state reported while sending once the call is accepted", () => {
    const { tracker, controller, states } = setup();
    controller.send("vacuum.one", kitchen);
    tracker.observe(states.set("vacuum.one", "cleaning"));
    controller.answer("vacuum.one", { kind: "accepted" });
    expect(phases(entriesOn(tracker, kitchen))).toEqual(["cleaning"]);
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
      expect(phases(entriesOn(tracker, kitchen))).toEqual(["starting"]);
      tracker.observe(states.set("vacuum.one", "docked"));
      tracker.observe(states.set("vacuum.one", "cleaning"));
      expect(phases(entriesOn(tracker, kitchen))).toEqual(["cleaning"]);
    },
  );

  it("flags status unknown from a confirm while the state is unknown", () => {
    const { tracker, controller } = setup();
    controller.send("vacuum.one", kitchen, "unknown");
    controller.answer("vacuum.one", { kind: "accepted" });
    expect(entriesOn(tracker, kitchen)).toMatchObject([{ phase: "starting", statusUnknown: true }]);
  });

  it("flags status unknown when the vacuum leaves the states", () => {
    const { tracker, controller, states } = setup();
    controller.started("vacuum.one", kitchen);
    tracker.observe(states.set("vacuum.one", undefined));
    expect(entriesOn(tracker, kitchen)).toMatchObject([{ phase: "starting", statusUnknown: true }]);
  });

  it("keeps the error of a refused start, and only the item, phase and error", () => {
    const { tracker, controller } = setup();
    controller.started("vacuum.one", kitchen, { kind: "error", error: notLinked });
    const [entry] = entriesOn(tracker, kitchen);
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
    expect(phases(entriesOn(tracker, kitchen))).toEqual(["not_started"]);
  });

  it("lists every robot sent to the item, by vacuum entity id", () => {
    const { tracker, controller } = setup();
    controller.started("vacuum.two", kitchen);
    controller.started("vacuum.one", kitchen, { kind: "changed" });
    expect(entriesOn(tracker, kitchen).map((e) => [e.vacuumEntityId, e.phase])).toEqual([
      ["vacuum.one", "not_started"],
      ["vacuum.two", "starting"],
    ]);
  });

  it("replaces a robot's entry with its new start", () => {
    const { tracker, controller } = setup();
    controller.started("vacuum.one", kitchen);
    controller.started("vacuum.one", hall, { kind: "changed" });
    expect(entriesOn(tracker, kitchen)).toEqual([]);
    expect(phases(entriesOn(tracker, hall))).toEqual(["not_started"]);
  });

  it("ignores an outcome for a robot it does not track", () => {
    const { tracker, controller } = setup();
    controller.answer("vacuum.one", { kind: "accepted" });
    expect(entriesOn(tracker, kitchen)).toEqual([]);
  });

  describe("observe", () => {
    it("feeds a robot's state only when its string changed", () => {
      const { tracker, controller, states } = setup();
      controller.started("vacuum.one", kitchen);
      tracker.observe(states.set("vacuum.one", "cleaning"));
      tracker.observe(states.set("vacuum.one", "paused"));
      const paused = tracker.entries();
      tracker.observe(states);
      expect(tracker.entries()).toBe(paused);
      expect(phases(paused)).toEqual(["paused"]);
    });

    it("reads only tracked robots", () => {
      const { tracker, states } = setup();
      tracker.observe(states);
      expect(states.reads).toBe(0);
    });
  });

  describe("identity", () => {
    it("returns the same array while no entry changed", () => {
      const { tracker, controller, states } = setup();
      controller.started("vacuum.one", kitchen);
      controller.started("vacuum.two", hall);
      tracker.observe(states);
      const before = tracker.entries();
      expect(tracker.entries()).toBe(before);
      tracker.observe(states);
      expect(tracker.entries()).toBe(before);
      tracker.observe(states.set("vacuum.one", "cleaning"));
      const after = tracker.entries();
      expect(after).not.toBe(before);
      expect(after[1]).toBe(before[1]);
    });

    it("keeps the array when only a state held while sending changed", () => {
      const { tracker, controller, states } = setup();
      controller.send("vacuum.one", kitchen);
      const sending = tracker.entries();
      tracker.observe(states.set("vacuum.one", "docked"));
      tracker.observe(states.set("vacuum.one", "idle"));
      expect(tracker.entries()).toBe(sending);
    });

    it("returns the same empty array without progress", () => {
      const { tracker, controller } = setup();
      expect(tracker.entries()).toBe(tracker.entries());
      controller.started("vacuum.one", kitchen);
      tracker.dismiss("vacuum.one");
      expect(tracker.entries()).toEqual([]);
      expect(tracker.entries()).toBe(tracker.entries());
    });
  });

  describe("dismiss", () => {
    it("removes the entry and acknowledges the outcome", () => {
      const { tracker, controller } = setup();
      controller.started("vacuum.one", kitchen);
      tracker.dismiss("vacuum.one");
      expect(entriesOn(tracker, kitchen)).toEqual([]);
      expect(controller.acknowledged).toEqual(["vacuum.one"]);
    });

    it("ignores the late outcome of a start dismissed while sending, and acknowledges it", () => {
      const { tracker, controller } = setup();
      controller.send("vacuum.one", kitchen);
      tracker.dismiss("vacuum.one");
      expect(controller.acknowledged).toEqual(["vacuum.one"]);
      controller.answer("vacuum.one", { kind: "accepted" });
      expect(entriesOn(tracker, kitchen)).toEqual([]);
      expect(controller.acknowledged).toEqual(["vacuum.one", "vacuum.one"]);
      controller.started("vacuum.one", hall);
      expect(controller.acknowledged).toHaveLength(2);
      expect(phases(entriesOn(tracker, hall))).toEqual(["starting"]);
    });
  });

  describe("entries", () => {
    it("lists every entry by vacuum entity id, the same array while nothing changed", () => {
      const { tracker, controller, states } = setup();
      expect(tracker.entries()).toEqual([]);
      controller.started("vacuum.two", hall);
      controller.started("vacuum.one", kitchen);
      const before = tracker.entries();
      expect(before.map((e) => [e.vacuumEntityId, e.item])).toEqual([
        ["vacuum.one", kitchen],
        ["vacuum.two", hall],
      ]);
      expect(tracker.entries()).toBe(before);
      tracker.observe(states);
      expect(tracker.entries()).toBe(before);
      tracker.observe(states.set("vacuum.two", "cleaning"));
      expect(tracker.entries()).not.toBe(before);
      tracker.dismiss("vacuum.one");
      tracker.dismiss("vacuum.two");
      expect(tracker.entries()).toEqual([]);
    });
  });

  describe("subscribe", () => {
    it("tells of each change the controller or a dismiss makes, until removed", () => {
      const { tracker, controller } = setup();
      let calls = 0;
      const remove = tracker.subscribe(() => {
        calls += 1;
      });
      controller.send("vacuum.one", kitchen);
      controller.answer("vacuum.one", { kind: "accepted" });
      expect(calls).toBe(2);
      tracker.dismiss("vacuum.one");
      expect(calls).toBe(3);
      controller.answer("vacuum.two", { kind: "accepted" });
      expect(calls).toBe(3);
      remove();
      controller.started("vacuum.one", kitchen);
      expect(calls).toBe(3);
    });

    it("does not tell of a change a state makes: the caller of observe reads it", () => {
      const { tracker, controller, states } = setup();
      controller.started("vacuum.one", kitchen);
      let calls = 0;
      tracker.subscribe(() => {
        calls += 1;
      });
      tracker.observe(states.set("vacuum.one", "cleaning"));
      expect(calls).toBe(0);
    });

    it("keeps telling the others when a listener throws", () => {
      const { tracker, controller } = setup();
      let calls = 0;
      tracker.subscribe(() => {
        throw new Error("listener");
      });
      tracker.subscribe(() => {
        calls += 1;
      });
      controller.send("vacuum.one", kitchen);
      expect(calls).toBe(1);
    });
  });

  it("stops following a controller once removed, and keeps what it showed", () => {
    const { tracker, controller, stopFollowing } = setup();
    controller.started("vacuum.one", kitchen);
    stopFollowing();
    controller.started("vacuum.two", hall);
    expect(tracker.entries().map((e) => e.vacuumEntityId)).toEqual(["vacuum.one"]);
  });

  describe("across controllers", () => {
    it("keeps the entries of a controller it no longer follows, and follows a new one", () => {
      const { tracker, controller, states } = setup();
      controller.started("vacuum.one", kitchen);
      const next = new FakeProgressController();
      tracker.follow(next);
      tracker.observe(states.set("vacuum.one", "cleaning"));
      next.started("vacuum.two", hall);
      expect(tracker.entries().map((e) => [e.vacuumEntityId, e.phase])).toEqual([
        ["vacuum.one", "cleaning"],
        ["vacuum.two", "starting"],
      ]);
    });

    it("acknowledges a dismissed outcome on the controller that stored it", () => {
      const { tracker, controller } = setup();
      controller.started("vacuum.one", kitchen);
      const next = new FakeProgressController();
      tracker.follow(next);
      tracker.dismiss("vacuum.one");
      expect(controller.acknowledged).toEqual(["vacuum.one"]);
      expect(next.acknowledged).toEqual([]);
    });

    it("applies the late outcome of a start sent before the card came back", () => {
      const { tracker, controller } = setup();
      controller.send("vacuum.one", kitchen);
      tracker.follow(new FakeProgressController());
      controller.answer("vacuum.one", { kind: "accepted" });
      expect(phases(tracker.entries())).toEqual(["starting"]);
    });

    it("ignores the outcome of an older start once a newer one replaced it", () => {
      const { tracker, controller } = setup();
      controller.send("vacuum.one", kitchen);
      const next = new FakeProgressController();
      tracker.follow(next);
      next.send("vacuum.one", hall);
      controller.answer("vacuum.one", { kind: "changed" });
      expect(tracker.entries().map((e) => [e.item, e.phase])).toEqual([[hall, "sending"]]);
    });
  });
});
