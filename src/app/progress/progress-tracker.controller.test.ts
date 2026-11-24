import { describe, expect, it } from "vitest";
import { FakeHass } from "../../../test/fakes/fake-hass";
import { FakeRoomSource } from "../../../test/fakes/fake-room-source";
import type { ItemRef } from "../robots-for-item/robots-for-item";
import { createCleanController } from "../start-clean/clean-controller";
import type { Intent } from "../start-clean/intent";
import { createProgressTracker, type ProgressEntry } from "./progress-tracker";

const item: ItemRef = { kind: "area", imageEntityId: "image.robot_one_floor_plan_mapa_q1w2e3", areaId: "library" };

function setup() {
  const hass = new FakeHass({ services: ["vacuum.clean_area"] });
  const controller = createCleanController({ hass, sources: () => [new FakeRoomSource()] });
  const tracker = createProgressTracker(controller);
  const intent = (): Intent => {
    const prepared = controller.prepare(item, "vacuum.robot_one");
    if (prepared.kind !== "intent") throw new Error(prepared.kind);
    return prepared.intent;
  };
  return { hass, controller, tracker, intent };
}

const phases = (entries: readonly ProgressEntry[]) => entries.map((e) => e.phase);

describe("progress with the clean controller", () => {
  it("shows sending as soon as confirm is called, then starting", async () => {
    const { hass, controller, tracker, intent } = setup();
    const answer = controller.confirm(intent());
    expect(phases(tracker.forItem(item))).toEqual(["sending"]);
    await answer;
    tracker.observe(hass);
    expect(tracker.forItem(item)).toEqual([
      { vacuumEntityId: "vacuum.robot_one", item, phase: "starting", statusUnknown: false },
    ]);
  });

  it("changes nothing on busy, already_sent and discarded", async () => {
    const { controller, tracker, intent } = setup();
    const first = intent();
    const inFlight = controller.confirm(first);
    const sending = tracker.forItem(item);
    const busy = controller.confirm(intent());
    expect(tracker.forItem(item)).toBe(sending);
    await expect(busy).resolves.toEqual({ kind: "busy" });
    await inFlight;
    const starting = tracker.forItem(item);
    await expect(controller.confirm(first)).resolves.toEqual({ kind: "already_sent" });
    const dismissed = intent();
    controller.dismiss(dismissed);
    await expect(controller.confirm(dismissed)).resolves.toEqual({ kind: "discarded" });
    expect(tracker.forItem(item)).toBe(starting);
    expect(phases(starting)).toEqual(["starting"]);
  });

  it("acknowledges the controller's outcome on dismiss", async () => {
    const { controller, tracker, intent } = setup();
    await controller.confirm(intent());
    tracker.dismiss("vacuum.robot_one");
    expect(controller.outcomeOf("vacuum.robot_one")).toBeUndefined();
    expect(tracker.forItem(item)).toEqual([]);
  });

  it("leaves no stored outcome for a start dismissed while sending", async () => {
    const { controller, tracker, intent } = setup();
    const answer = controller.confirm(intent());
    tracker.dismiss("vacuum.robot_one");
    await answer;
    expect(controller.outcomeOf("vacuum.robot_one")).toBeUndefined();
    expect(tracker.forItem(item)).toEqual([]);
  });
});
