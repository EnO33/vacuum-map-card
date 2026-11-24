import { describe, expect, it } from "vitest";
import { FakeHass } from "../../../test/fakes/fake-hass";
import { FakeRoomSource } from "../../../test/fakes/fake-room-source";
import type { ItemRef } from "../robots-for-item/robots-for-item";
import { createCleanController } from "./clean-controller";
import type { Intent } from "./intent";

const item: ItemRef = { kind: "area", imageEntityId: "image.robot_one_floor_plan_mapa_q1w2e3", areaId: "library" };

function setup() {
  const hass = new FakeHass({ services: ["vacuum.clean_area"] });
  const controller = createCleanController({ hass, sources: () => [new FakeRoomSource()] });
  const intent = (): Intent => {
    const prepared = controller.prepare(item, "vacuum.robot_one");
    if (prepared.kind !== "intent") throw new Error(prepared.kind);
    return prepared.intent;
  };
  return { controller, intent };
}

describe("onSending", () => {
  it("tells, in the caller's task, that a confirm goes on to the re-check and the call", async () => {
    const { controller, intent } = setup();
    const seen: string[] = [];
    controller.onSending((sent) => seen.push(`sending ${sent.vacuumEntityId}`));
    controller.onOutcome((id, outcome) => seen.push(`${id} ${outcome.kind}`));
    const confirmed = intent();
    const answer = controller.confirm(confirmed);
    expect(seen).toEqual(["sending vacuum.robot_one"]);
    await answer;
    expect(seen).toEqual(["sending vacuum.robot_one", "vacuum.robot_one accepted"]);
  });

  it("is not called for an answer that sends nothing", async () => {
    const { controller, intent } = setup();
    const seen: Intent[] = [];
    controller.onSending((sent) => seen.push(sent));
    const first = intent();
    const inFlight = controller.confirm(first);
    await expect(controller.confirm(intent())).resolves.toEqual({ kind: "busy" });
    await inFlight;
    await expect(controller.confirm(first)).resolves.toEqual({ kind: "already_sent" });
    const dismissed = intent();
    controller.dismiss(dismissed);
    await expect(controller.confirm(dismissed)).resolves.toEqual({ kind: "discarded" });
    expect(seen).toEqual([first]);
  });

  it("calls every listener even when one throws, and stops a removed one", async () => {
    const { controller, intent } = setup();
    const seen: string[] = [];
    controller.onSending(() => {
      throw new Error("broken listener");
    });
    const stop = controller.onSending(() => seen.push("removed"));
    controller.onSending((sent) => seen.push(sent.vacuumEntityId));
    stop();
    await expect(controller.confirm(intent())).resolves.toEqual({ kind: "accepted" });
    expect(seen).toEqual(["vacuum.robot_one"]);
  });
});
