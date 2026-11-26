import { describe, expect, it } from "vitest";
import { FakeHass, type FakeHassSettings } from "../../../test/fakes/fake-hass";
import { FakeRoomSource } from "../../../test/fakes/fake-room-source";
import { portOf, roomsMapWith, withLastSeen, withMapping, withVacuum } from "../../../test/helpers/clean-state";
import { withRobot } from "../../../test/helpers/sources";
import type { RoomSource } from "../ports/room-source";
import type { ServiceResult } from "../ports/service-call";
import type { ItemRef } from "../robots-for-item/robots-for-item";
import { createCleanController } from "./clean-controller";
import type { Intent } from "./intent";

const MAP_A = "image.robot_one_floor_plan_mapa_q1w2e3";
const libraryItem: ItemRef = { kind: "area", imageEntityId: MAP_A, areaId: "library" };
const roomItem: ItemRef = { kind: "room", imageEntityId: "image.robot_one_rooms_map", regionId: "1" };

/** A fake whose `callService` stays pending until `settle` is called, recording every call. */
class PendingHass extends FakeHass {
  #settle: ((result: ServiceResult) => void) | undefined;
  override callService(call: Parameters<FakeHass["callService"]>[0]): Promise<ServiceResult> {
    this.calls.push(call);
    return new Promise((resolve) => {
      this.#settle = resolve;
    });
  }
  settle(result: ServiceResult = { ok: true }): void {
    this.#settle?.(result);
  }
}

const settings: FakeHassSettings = { services: ["vacuum.clean_area"] };

function setup(hass = new FakeHass(settings), sources: readonly RoomSource[] = [new FakeRoomSource()]) {
  const controller = createCleanController({ hass, sources: () => sources });
  return { hass, controller };
}

function prepared(intent: ReturnType<ReturnType<typeof setup>["controller"]["prepare"]>): Intent {
  if (intent.kind !== "intent") throw new Error(`expected an intent, got ${JSON.stringify(intent)}`);
  return intent.intent;
}

describe("prepare", () => {
  it("captures a deeply frozen path 1 intent with exactly the expected keys", () => {
    const { controller } = setup();
    const intent = prepared(controller.prepare(libraryItem, "vacuum.robot_one"));
    expect(intent).toEqual({
      vacuumEntityId: "vacuum.robot_one",
      action: "vacuum",
      item: libraryItem,
      path: {
        path: 1,
        areaId: "library",
        areaName: "Library",
        roomNames: ["Library"],
        mapId: "MapA_q1W2e3",
        segments: [{ segmentId: "MapA_q1W2e3_1", name: "Library" }],
      },
    });
    expect(Object.isFrozen(intent)).toBe(true);
    expect(Object.isFrozen(intent.path)).toBe(true);
    expect(Object.keys(intent).sort()).toEqual(["action", "item", "path", "vacuumEntityId"]);
  });

  it("captures a path 2 intent with the adapter's call and the rooms map projection, without its token", () => {
    const { controller } = setup();
    const intent = prepared(controller.prepare(roomItem, "vacuum.robot_one"));
    expect(intent).toMatchObject({
      path: {
        path: 2,
        regionId: "1",
        roomName: "Library",
        call: { domain: "roomba_plus", service: "clean_room", data: { entity_id: "vacuum.robot_one", room_name: "1" } },
      },
      roomsMap: {
        state: "2026-01-01T09:30:00.123456+00:00",
        rooms: [{ regionId: "1", name: "Library", roomId: "library" }],
      },
    });
    expect(Object.keys(intent).sort()).toEqual(["action", "item", "path", "roomsMap", "vacuumEntityId"]);
    expect(JSON.stringify(intent)).not.toMatch(/access_token|entity_picture|token|attributes/);
  });

  it("gives the candidate's reasons when the robot cannot start", () => {
    const { controller } = setup(new FakeHass());
    expect(controller.prepare(libraryItem, "vacuum.robot_one")).toEqual({
      kind: "not_startable",
      reasons: ["service_missing"],
    });
  });

  it("gives not_listed for a robot the item does not list", () => {
    const { controller } = setup();
    expect(controller.prepare(libraryItem, "vacuum.robot_two")).toEqual({ kind: "not_listed" });
  });

  it("sends nothing while building the model, listing robots and preparing intents", () => {
    const { hass, controller } = setup();
    controller.prepare(libraryItem, "vacuum.robot_one");
    controller.prepare(roomItem, "vacuum.robot_one");
    controller.prepare(libraryItem, "vacuum.robot_two");
    expect(hass.calls).toEqual([]);
  });
});

describe("confirm", () => {
  it("sends exactly the path 1 call and gives accepted, never « cleaning »", async () => {
    const { hass, controller } = setup();
    const outcome = await controller.confirm(prepared(controller.prepare(libraryItem, "vacuum.robot_one")));
    expect(hass.calls).toStrictEqual([
      {
        domain: "vacuum",
        service: "clean_area",
        data: { cleaning_area_id: ["library"] },
        target: { entity_id: "vacuum.robot_one" },
      },
    ]);
    expect(outcome).toEqual({ kind: "accepted" });
  });

  it("sends exactly the adapter's call on path 2", async () => {
    const { hass, controller } = setup();
    await controller.confirm(prepared(controller.prepare(roomItem, "vacuum.robot_one")));
    expect(hass.calls).toStrictEqual([
      { domain: "roomba_plus", service: "clean_room", data: { entity_id: "vacuum.robot_one", room_name: "1" } },
    ]);
  });

  it("guards against a second confirm in the same task: one call, one busy", async () => {
    const hass = new PendingHass(settings);
    const { controller } = setup(hass);
    const intent = prepared(controller.prepare(libraryItem, "vacuum.robot_one"));
    const other = prepared(controller.prepare(libraryItem, "vacuum.robot_one"));
    const first = controller.confirm(intent);
    const second = controller.confirm(other);
    const again = controller.confirm(intent);
    await expect(second).resolves.toEqual({ kind: "busy" });
    await expect(again).resolves.toEqual({ kind: "already_sent" });
    hass.settle();
    await expect(first).resolves.toEqual({ kind: "accepted" });
    expect(hass.calls).toHaveLength(1);
  });

  it("releases the robot when the call settles, whatever the result", async () => {
    const { hass, controller } = setup(new FakeHass({ ...settings, result: { ok: false, error: { code: "x" } } }));
    await controller.confirm(prepared(controller.prepare(libraryItem, "vacuum.robot_one")));
    await controller.confirm(prepared(controller.prepare(libraryItem, "vacuum.robot_one")));
    expect(hass.calls).toHaveLength(2);
  });

  it("classifies an error and never retries nor switches path", async () => {
    const unauthorized: ServiceResult = { ok: false, error: { code: "home_assistant_error", message: "Unauthorized" } };
    const { hass, controller } = setup(new FakeHass({ ...settings, result: unauthorized }));
    const outcome = await controller.confirm(prepared(controller.prepare(libraryItem, "vacuum.robot_one")));
    expect(outcome).toEqual({ kind: "error", error: { kind: "not_allowed", mayHaveStarted: "no" } });
    expect(hass.calls).toHaveLength(1);
  });
});

describe("confirm re-checks the intent against the current state", () => {
  async function changedBy(change: { hass?: FakeHass; sources?: readonly RoomSource[] }, item = libraryItem) {
    let hass = new FakeHass(settings);
    let sources: readonly RoomSource[] = [new FakeRoomSource()];
    const controller = createCleanController({ hass: portOf(() => hass), sources: () => sources });
    const intent = prepared(controller.prepare(item, "vacuum.robot_one"));
    hass = change.hass ?? hass;
    sources = change.sources ?? sources;
    const outcome = await controller.confirm(intent);
    return { outcome, calls: hass.calls };
  }

  it.each([
    ["the robot became unavailable", { hass: withVacuum("unavailable") }],
    ["the robot lost its state", { hass: withVacuum(undefined) }],
    ["a segments_changed issue opened", { hass: new FakeHass({ ...settings, segmentsChanged: ["vacuum.robot_one"] }) }],
    ["the area's segments changed", { hass: withMapping([["library", ["MapA_q1W2e3_1", "MapA_q1W2e3_zid_1"]]]) }],
    ["the area's names changed", { hass: withLastSeen("Reading room") }],
  ])("sends nothing when %s", async (_, change) => {
    const { outcome, calls } = await changedBy(change);
    expect(outcome).toEqual({ kind: "changed" });
    expect(calls).toEqual([]);
  });

  it.each([
    ["the rooms map state changed", roomsMapWith((s) => ({ ...s, state: "2026-01-01T10:00:00+00:00" }))],
    ["a projected room changed", roomsMapWith((s) => ({ ...s, rooms: s.rooms.map((r) => ({ ...r, name: "Den" })) }))],
    [
      "path 2 is no longer startable",
      [withRobot(new FakeRoomSource(), "vacuum.robot_one", () => ({ roomAction: () => undefined }))],
    ],
  ])("sends nothing for a room when %s", async (_, sources) => {
    const { outcome, calls } = await changedBy({ sources }, roomItem);
    expect(outcome).toEqual({ kind: "changed" });
    expect(calls).toEqual([]);
  });

  it("still sends for a new snapshot object with equal values (token rotation)", async () => {
    const { outcome, calls } = await changedBy({ sources: roomsMapWith((s) => structuredClone(s)) }, roomItem);
    expect(outcome).toEqual({ kind: "accepted" });
    expect(calls).toHaveLength(1);
  });
});

describe("outcome delivery", () => {
  it("stores every outcome per robot until acknowledged, and notifies listeners", async () => {
    const { controller } = setup();
    const seen: string[] = [];
    controller.onOutcome((id, outcome) => seen.push(`${id} ${outcome.kind}`));
    await controller.confirm(prepared(controller.prepare(libraryItem, "vacuum.robot_one")));
    expect(seen).toEqual(["vacuum.robot_one accepted"]);
    expect(controller.outcomeOf("vacuum.robot_one")).toEqual({ kind: "accepted" });
    controller.acknowledge("vacuum.robot_one");
    expect(controller.outcomeOf("vacuum.robot_one")).toBeUndefined();
  });

  it("discards a dismissed intent and sends nothing", async () => {
    const { hass, controller } = setup();
    const intent = prepared(controller.prepare(libraryItem, "vacuum.robot_one"));
    controller.dismiss(intent);
    await expect(controller.confirm(intent)).resolves.toEqual({ kind: "discarded" });
    expect(hass.calls).toEqual([]);
  });

  it("keeps the call and its outcome when the dialog is dismissed and every listener removed meanwhile", async () => {
    const hass = new PendingHass(settings);
    const { controller } = setup(hass);
    const stop = controller.onOutcome(() => undefined);
    const intent = prepared(controller.prepare(libraryItem, "vacuum.robot_one"));
    const pending = controller.confirm(intent);
    controller.dismiss(intent);
    stop();
    hass.settle();
    await pending;
    expect(hass.calls).toHaveLength(1);
    // A listener added later reads the stored outcome; it is not called for a past outcome.
    const later: string[] = [];
    controller.onOutcome((id, outcome) => later.push(`${id} ${outcome.kind}`));
    expect(later).toEqual([]);
    expect(controller.outcomeOf("vacuum.robot_one")).toEqual({ kind: "accepted" });
  });
});
