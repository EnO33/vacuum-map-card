// The fixture-backed fakes of `test/fakes/`: the contract Epic 3 use cases are tested against.
import { describe, expect, it, vi } from "vitest";
import { FakeHass } from "../../../test/fakes/fake-hass";
import { FakeRoomSource } from "../../../test/fakes/fake-room-source";
import { unsupported } from "../../domain/unsupported";
import type { HassPort } from "./hass-port";
import type { RoomSource, SourceRobot } from "./room-source";

function robot(source: RoomSource, entityId: string): SourceRobot {
  const found = source.robots().find((r) => r.vacuumEntityId === entityId);
  if (!found) throw new Error(`no robot ${entityId}`);
  return found;
}

describe("FakeHass", () => {
  const hass: HassPort = new FakeHass();

  it("keeps the same registry objects between calls", () => {
    expect(hass.floors()).toBe(hass.floors());
    expect(hass.areas()).toBe(hass.areas());
    expect(hass.vacuumOptions("vacuum.robot_one")).toBe(hass.vacuumOptions("vacuum.robot_one"));
  });

  it("keeps the floor registry list order", () => {
    expect(hass.floors()?.map((f) => f.floorId)).toEqual(["ground_floor", "upper_floor"]);
    expect(hass.floors()?.[0]).toEqual({ floorId: "ground_floor", name: "Ground floor", aliases: [] });
  });

  it("gives the areas keyed by area id, with an area on no floor", () => {
    const areas = hass.areas();
    expect(areas.size).toBe(8);
    expect(areas.get("library")).toEqual({ areaId: "library", name: "Library", aliases: [], floorId: "ground_floor" });
    expect(areas.get("greenhouse")?.floorId).toBeNull();
  });

  it("gives a vacuum's state and features, or undefined without a state", () => {
    expect(hass.vacuum("vacuum.robot_one")).toEqual({ state: "docked", supportedFeatures: 29500 });
    expect(hass.vacuum("vacuum.robot_two")?.supportedFeatures).toBe(13116);
    expect(hass.vacuum("vacuum.missing")).toBeUndefined();
  });

  it("gives the vacuum options of each robot", () => {
    const options = hass.vacuumOptions("vacuum.robot_one");
    if (options.kind !== "options") throw new Error(options.reason);
    if (options.areaMapping.kind !== "list" || options.lastSeenSegments.kind !== "list") throw new Error("lists");
    expect(options.areaMapping.list.get("workshop")).toEqual(["MapA_q1W2e3_zid_2"]);
    expect(options.lastSeenSegments.list).toHaveLength(7);
    expect(hass.vacuumOptions("vacuum.robot_two")).toEqual({
      kind: "options",
      areaMapping: { kind: "absent" },
      lastSeenSegments: { kind: "absent" },
    });
    expect(hass.vacuumOptions("vacuum.missing")).toEqual(unsupported("registry_entry_unreadable"));
  });

  it("answers services, repairs and admin from its settings", () => {
    const configured = new FakeHass({
      services: ["vacuum.clean_area"],
      segmentsChanged: ["vacuum.robot_one"],
      admin: true,
    });
    expect(configured.hasService("vacuum", "clean_area")).toBe(true);
    expect(configured.hasService("roomba_plus", "clean_room")).toBe(false);
    expect(configured.segmentsChangedOpen("vacuum.robot_one")).toBe(true);
    expect(configured.segmentsChangedOpen("vacuum.robot_two")).toBe(false);
    expect(configured.isAdmin()).toBe(true);
    expect(hass.isAdmin()).toBe(false);
  });

  it("records calls and resolves with the configured result, never really calling", async () => {
    const error = {
      code: "service_validation_error",
      translationDomain: "roomba_plus",
      translationKey: "unknown_rooms",
    };
    const fake = new FakeHass({ result: { ok: false, error } });
    const call = { domain: "vacuum", service: "clean_area", data: { cleaning_area_id: ["library"] } };
    await expect(fake.callService(call)).resolves.toEqual({ ok: false, error });
    expect(fake.calls).toEqual([call]);
    await expect(new FakeHass().callService(call)).resolves.toEqual({ ok: true });
  });

  it("notifies subscribers until they unsubscribe", () => {
    const fake = new FakeHass();
    const listener = vi.fn();
    const unsubscribe = fake.subscribe(listener);
    fake.emit();
    unsubscribe();
    fake.emit();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("FakeRoomSource", () => {
  const source: RoomSource = new FakeRoomSource();

  it("keeps the same robots between calls", () => {
    expect(source.robots()).toBe(source.robots());
  });

  it("reports Roomba+ robots found by platform", () => {
    expect(source.integration).toBe("roomba_plus");
    expect(source.robots().map((r) => r.vacuumEntityId)).toEqual(["vacuum.robot_one", "vacuum.robot_two"]);
  });

  it("gives the mop robot two stored maps and the action mop", () => {
    const mop = robot(source, "vacuum.robot_two");
    expect(mop.action).toBe("mop");
    expect(mop.storedMaps.map((m) => m.mapId)).toEqual(["MapC_k4L5m6", "MapD_r7T8y9"]);
    expect(mop.storedMaps[1]).toEqual({
      floorPlanEntityId: "image.robot_two_floor_plan_mapd_r7t8y9",
      mapId: "MapD_r7T8y9",
      mapName: "Upper level",
      pictureState: "available",
      ownAreaId: null,
    });
  });

  it("reports a disabled floor plan, with no name since it has no state", () => {
    const vacuum = robot(new FakeRoomSource({ disabledFloorPlans: true }), "vacuum.robot_one");
    expect(vacuum.storedMaps.find((m) => m.mapId === "MapB_z9X8c7")).toMatchObject({
      pictureState: "disabled",
      mapName: undefined,
    });
  });

  it("gives the rooms map snapshot", () => {
    const { roomsMap } = robot(source, "vacuum.robot_one");
    expect(roomsMap?.imageEntityId).toBe("image.robot_one_rooms_map");
    if (roomsMap?.content.kind !== "snapshot") throw new Error("expected a snapshot");
    expect(roomsMap.content.snapshot.rooms.map((r) => r.regionId)).toEqual(["1"]);
  });

  it("links segments and maps in the Roomba+ Classic id format", () => {
    const vacuum = robot(source, "vacuum.robot_one");
    expect(vacuum.mapOfSegment("MapA_q1W2e3_zid_2")).toBe("MapA_q1W2e3");
    expect(vacuum.mapOfSegment("MapB_z9X8c7_3")).toBe("MapB_z9X8c7");
    expect(vacuum.mapOfSegment("MapZ_unknown_1")).toBeUndefined();
    expect(robot(source, "vacuum.robot_two").mapOfSegment("MapA_q1W2e3_1")).toBeUndefined();
    expect(vacuum.segmentOf("MapB_z9X8c7", "2")).toBe("MapB_z9X8c7_2");
    expect(vacuum.mapOfSegment(vacuum.segmentOf("MapA_q1W2e3", "2") ?? "")).toBe("MapA_q1W2e3");
    expect(vacuum.segmentOf("MapB_z9X8c7", "x".repeat(250))).toBeUndefined();
  });

  it("builds the room action with the region id only", () => {
    const vacuum = robot(source, "vacuum.robot_one");
    expect(vacuum.roomAction("3")).toEqual({
      domain: "roomba_plus",
      service: "clean_room",
      data: { entity_id: "vacuum.robot_one", room_name: "3" },
    });
    expect(vacuum.roomActionMatchesNamesFirst).toBe(true);
  });

  it("classifies only the errors it was given, and only from its own domain", () => {
    const fake = new FakeRoomSource({ errorKinds: new Map([["unknown_rooms", "room_not_found"]]) });
    const vacuum = robot(fake, "vacuum.robot_one");
    const error = {
      code: "service_validation_error",
      translationDomain: "roomba_plus",
      translationKey: "unknown_rooms",
    };
    expect(vacuum.classifyError(error)).toBe("room_not_found");
    expect(vacuum.classifyError({ ...error, translationDomain: "vacuum" })).toBeUndefined();
    expect(vacuum.classifyError({ ...error, translationKey: "map_updating" })).toBeUndefined();
    expect(robot(source, "vacuum.robot_one").classifyError(error)).toBeUndefined();
  });
});
