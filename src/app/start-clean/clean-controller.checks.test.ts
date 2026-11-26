// The review cases of #56: joined path 2, real path switches, error routing, release, and the hardening.
import { describe, expect, it } from "vitest";
import { FakeHass, type FakeHassSettings } from "../../../test/fakes/fake-hass";
import { FakeRoomSource } from "../../../test/fakes/fake-room-source";
import { withRobot } from "../../../test/helpers/sources";
import { fixtureMaps } from "../../../test/helpers/stored-maps";
import type { HassPort, VacuumOptions } from "../ports/hass-port";
import type { RoomSource, SourceRobot } from "../ports/room-source";
import type { ServiceResult } from "../ports/service-call";
import type { ItemRef } from "../robots-for-item/robots-for-item";
import { createCleanController } from "./clean-controller";
import type { Intent } from "./intent";

const clean: FakeHassSettings = { services: ["vacuum.clean_area"] };
const vacuumRoom: ItemRef = { kind: "room", imageEntityId: "image.robot_one_rooms_map", regionId: "1" };
const libraryOnA: VacuumOptions = {
  kind: "options",
  areaMapping: { kind: "list", list: new Map([["library", ["MapA_q1W2e3_1"]]]) },
  lastSeenSegments: { kind: "list", list: [{ id: "MapA_q1W2e3_1", name: "Library" }] },
};

/** A controller over swappable state, so a test can change hass or sources between prepare and confirm. */
function harness(hass: FakeHass, sources: readonly RoomSource[]) {
  const state = { hass, sources };
  const port: HassPort = {
    floors: () => state.hass.floors(),
    fetchFailed: () => state.hass.fetchFailed(),
    areas: () => state.hass.areas(),
    vacuum: (id) => state.hass.vacuum(id),
    hasService: (domain, service) => state.hass.hasService(domain, service),
    vacuumOptions: (id) => state.hass.vacuumOptions(id),
    segmentsChangedOpen: (id) => state.hass.segmentsChangedOpen(id),
    isAdmin: () => state.hass.isAdmin(),
    callService: (call) => state.hass.callService(call),
    subscribe: (listener) => state.hass.subscribe(listener),
  };
  return { state, controller: createCleanController({ hass: port, sources: () => state.sources }) };
}

function intentOf(result: ReturnType<ReturnType<typeof harness>["controller"]["prepare"]>): Intent {
  if (result.kind !== "intent") throw new Error(`expected an intent, got ${JSON.stringify(result)}`);
  return result.intent;
}

/** The vacuum robot with one stored map, its rooms map paired with it. */
const paired = (source = new FakeRoomSource()) =>
  withRobot(source, "vacuum.robot_one", (robot) => ({
    storedMaps: [fixtureMaps.mapA],
    roomsMap: robot.roomsMap && { ...robot.roomsMap, shownMapId: fixtureMaps.mapA.mapId },
  }));

function withState(source: RoomSource, entityId: string, state: string): RoomSource {
  return withRobot(source, entityId, (robot: SourceRobot) => {
    const roomsMap = robot.roomsMap;
    if (roomsMap?.content.kind !== "snapshot") throw new Error("expected a snapshot");
    const snapshot = { ...structuredClone(roomsMap.content.snapshot), state };
    return { roomsMap: { ...roomsMap, content: { kind: "snapshot", snapshot } } };
  });
}

describe("a joining robot's own rooms map", () => {
  /** Both robots on ground_floor, no clean_area service: the vacuum robot joins the mop robot's room by path 2. */
  const onGround = withRobot(
    withRobot(new FakeRoomSource(), "vacuum.robot_two", (r) => ({
      storedMaps: r.storedMaps.map((m) => (m.mapId === "MapD_r7T8y9" ? { ...m, ownAreaId: "library" } : m)),
    })),
    "vacuum.robot_one",
    (r) => ({ storedMaps: r.storedMaps.map((m) => (m.mapId === "MapB_z9X8c7" ? { ...m, ownAreaId: "library" } : m)) }),
  );
  const mopRoom: ItemRef = { kind: "room", imageEntityId: "image.robot_two_rooms_map", regionId: "1" };

  it("is captured and re-checked: a new state sends nothing", async () => {
    const { state, controller } = harness(new FakeHass(), [onGround]);
    const intent = intentOf(controller.prepare(mopRoom, "vacuum.robot_one"));
    expect(intent.path).toMatchObject({
      path: 2,
      regionId: "1",
      roomsMap: { state: "2026-01-01T09:30:00.123456+00:00" },
    });
    state.sources = [withState(onGround, "vacuum.robot_one", "2026-01-01T11:00:00+00:00")];
    await expect(controller.confirm(intent)).resolves.toEqual({ kind: "changed" });
    expect(state.hass.calls).toEqual([]);
  });
});

describe("real path and area changes", () => {
  it("sends nothing when path 2 became path 1", async () => {
    const { state, controller } = harness(new FakeHass(clean), [new FakeRoomSource()]);
    const intent = intentOf(controller.prepare(vacuumRoom, "vacuum.robot_one"));
    expect(intent.path.path).toBe(2);
    state.hass = new FakeHass({ ...clean, vacuumOptions: new Map([["vacuum.robot_one", libraryOnA]]) });
    state.sources = [paired()];
    await expect(controller.confirm(intent)).resolves.toEqual({ kind: "changed" });
    expect(state.hass.calls).toEqual([]);
  });

  it("sends nothing when the area was renamed after the question showed its name", async () => {
    const options = { ...clean, vacuumOptions: new Map([["vacuum.robot_one", libraryOnA]]) };
    const { state, controller } = harness(new FakeHass(options), [paired()]);
    const intent = intentOf(controller.prepare(vacuumRoom, "vacuum.robot_one"));
    expect(intent.path).toMatchObject({ path: 1, areaName: "Library" });
    const renamed = new Map(state.hass.areas());
    const library = renamed.get("library");
    if (!library) throw new Error("no library area");
    renamed.set("library", { ...library, name: "Reading room" });
    state.hass = new FakeHass({ ...options, areas: renamed });
    await expect(controller.confirm(intent)).resolves.toEqual({ kind: "changed" });
    expect(state.hass.calls).toEqual([]);
  });

  it("sends nothing when the room's segment moved to another area", async () => {
    const hass = new FakeHass({ ...clean, vacuumOptions: new Map([["vacuum.robot_one", libraryOnA]]) });
    const { state, controller } = harness(hass, [paired()]);
    const intent = intentOf(controller.prepare(vacuumRoom, "vacuum.robot_one"));
    expect(intent.path).toMatchObject({ path: 1, areaId: "library" });
    const moved: VacuumOptions = {
      ...libraryOnA,
      areaMapping: { kind: "list", list: new Map([["workshop", ["MapA_q1W2e3_1"]]]) },
    };
    state.hass = new FakeHass({ ...clean, vacuumOptions: new Map([["vacuum.robot_one", moved]]) });
    await expect(controller.confirm(intent)).resolves.toEqual({ kind: "changed" });
    expect(state.hass.calls).toEqual([]);
  });

  it("captures the paired map on path 2", () => {
    const hass = new FakeHass({ vacuumOptions: new Map([["vacuum.robot_one", libraryOnA]]) });
    const { controller } = harness(hass, [paired()]);
    const intent = intentOf(controller.prepare(vacuumRoom, "vacuum.robot_one"));
    expect(intent.path).toStrictEqual({
      path: 2,
      regionId: "1",
      roomName: "Library",
      call: { domain: "roomba_plus", service: "clean_room", data: { entity_id: "vacuum.robot_one", room_name: "1" } },
      roomsMap: {
        state: "2026-01-01T09:30:00.123456+00:00",
        rooms: [{ regionId: "1", name: "Library", roomId: "library" }],
      },
      mapId: "MapA_q1W2e3",
    });
  });
});

describe("errors by path and integration", () => {
  const failing = (result: ServiceResult, settings: FakeHassSettings = clean) => new FakeHass({ ...settings, result });

  it("classifies an integration refusal on path 2 through the robot's own source", async () => {
    const source = new FakeRoomSource({ errorKinds: new Map([["unknown_rooms", "room_not_found"]]) });
    const error = {
      code: "service_validation_error",
      translationDomain: "roomba_plus",
      translationKey: "unknown_rooms",
    };
    const { controller } = harness(failing({ ok: false, error }), [source]);
    await expect(controller.confirm(intentOf(controller.prepare(vacuumRoom, "vacuum.robot_one")))).resolves.toEqual({
      kind: "error",
      error: { kind: "room_not_found", mayHaveStarted: "no" },
    });
  });

  it("tells a missing service apart on each path", async () => {
    const error = { code: "not_found", translationDomain: "homeassistant", translationKey: "service_not_found" };
    const area: ItemRef = { kind: "area", imageEntityId: "image.robot_one_floor_plan_mapa_q1w2e3", areaId: "library" };
    const one = harness(failing({ ok: false, error }), [new FakeRoomSource()]);
    const two = harness(failing({ ok: false, error }), [new FakeRoomSource()]);
    await expect(
      one.controller.confirm(intentOf(one.controller.prepare(area, "vacuum.robot_one"))),
    ).resolves.toMatchObject({
      error: { kind: "ha_lacks_area_cleaning" },
    });
    await expect(
      two.controller.confirm(intentOf(two.controller.prepare(vacuumRoom, "vacuum.robot_one"))),
    ).resolves.toMatchObject({
      error: { kind: "integration_not_ready" },
    });
  });
});

describe("release and hardening", () => {
  it("releases the robot after accepted and after changed", async () => {
    const { state, controller } = harness(new FakeHass(clean), [new FakeRoomSource()]);
    await controller.confirm(intentOf(controller.prepare(vacuumRoom, "vacuum.robot_one")));
    const stale = intentOf(controller.prepare(vacuumRoom, "vacuum.robot_one"));
    state.sources = [withState(new FakeRoomSource(), "vacuum.robot_one", "2026-01-01T12:00:00+00:00")];
    await expect(controller.confirm(stale)).resolves.toEqual({ kind: "changed" });
    await expect(controller.confirm(intentOf(controller.prepare(vacuumRoom, "vacuum.robot_one")))).resolves.toEqual({
      kind: "accepted",
    });
    expect(state.hass.calls).toHaveLength(2);
  });

  it("stores an unknown, possibly started outcome when the call rejects, and releases the robot", async () => {
    const hass = new FakeHass(clean);
    hass.callService = () => Promise.reject(new Error("socket closed"));
    const { controller } = harness(hass, [new FakeRoomSource()]);
    const outcome = await controller.confirm(intentOf(controller.prepare(vacuumRoom, "vacuum.robot_one")));
    expect(outcome).toEqual({ kind: "error", error: { kind: "unknown", mayHaveStarted: "unknown" } });
    expect(controller.outcomeOf("vacuum.robot_one")).toEqual(outcome);
    await expect(controller.confirm(intentOf(controller.prepare(vacuumRoom, "vacuum.robot_one")))).resolves.not.toEqual(
      {
        kind: "busy",
      },
    );
  });

  it("notifies every listener even when one throws", async () => {
    const { controller } = harness(new FakeHass(clean), [new FakeRoomSource()]);
    const seen: string[] = [];
    controller.onOutcome(() => {
      throw new Error("broken listener");
    });
    controller.onOutcome((id, outcome) => seen.push(`${id} ${outcome.kind}`));
    await controller.confirm(intentOf(controller.prepare(vacuumRoom, "vacuum.robot_one")));
    expect(seen).toEqual(["vacuum.robot_one accepted"]);
  });

  it("refuses an adapter call that targets another robot", () => {
    const wrong = withRobot(new FakeRoomSource(), "vacuum.robot_one", () => ({
      roomAction: (regionId: string) => ({
        domain: "roomba_plus",
        service: "clean_room",
        data: { entity_id: "vacuum.robot_two", room_name: regionId },
      }),
    }));
    const { controller } = harness(new FakeHass(clean), [wrong]);
    expect(controller.prepare(vacuumRoom, "vacuum.robot_one")).toEqual({
      kind: "not_startable",
      reasons: ["room_action_wrong_robot"],
    });
  });

  it("keeps only the item's own fields", () => {
    const { controller } = harness(new FakeHass(clean), [new FakeRoomSource()]);
    const richer = { ...vacuumRoom, pictureUrl: "/api/image_proxy/x?token=secret" };
    const intent = intentOf(controller.prepare(richer, "vacuum.robot_one"));
    expect(intent.item).toStrictEqual(vacuumRoom);
    expect(JSON.stringify(intent)).not.toContain("secret");
  });

  it("stores changed, not « may have started », when the re-check itself fails", async () => {
    const { state, controller } = harness(new FakeHass(clean), [new FakeRoomSource()]);
    const intent = intentOf(controller.prepare(vacuumRoom, "vacuum.robot_one"));
    state.sources = [
      {
        integration: "roomba_plus",
        integrationName: "Roomba+",
        loaded: () => true,
        robots: () => {
          throw new Error("adapter failed");
        },
      },
    ];
    await expect(controller.confirm(intent)).resolves.toEqual({ kind: "changed" });
    expect(state.hass.calls).toEqual([]);
  });

  it("stores unknown, possibly started, when classifying the error throws", async () => {
    const throwing = withRobot(new FakeRoomSource(), "vacuum.robot_one", () => ({
      classifyError: () => {
        throw new Error("adapter failed");
      },
    }));
    const error = { code: "service_validation_error", translationDomain: "roomba_plus", translationKey: "x" };
    const { controller } = harness(new FakeHass({ ...clean, result: { ok: false, error } }), [throwing]);
    await expect(controller.confirm(intentOf(controller.prepare(vacuumRoom, "vacuum.robot_one")))).resolves.toEqual({
      kind: "error",
      error: { kind: "unknown", mayHaveStarted: "unknown" },
    });
  });
});
