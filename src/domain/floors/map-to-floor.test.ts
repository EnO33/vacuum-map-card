import { describe, expect, it } from "vitest";
import areaRegistry from "../../../test/fixtures/ha-core/area_registry_list.json" with { type: "json" };
import floorRegistry from "../../../test/fixtures/ha-core/floor_registry_list.json" with { type: "json" };
import vacuumStates from "../../../test/fixtures/ha-core/hass_states_vacuum_docked.json" with { type: "json" };
import { areaMappingOf, knownAreaIds, mappingFixtures } from "../../../test/helpers/area-mapping";
import { areasOf, floorsOf } from "../../../test/helpers/registry";
import { fixtureMaps, mapOfSegmentIn } from "../../../test/helpers/stored-maps";
import { readAreaMapping } from "../mapping/area-mapping";
import type { Area } from "../registry/types";
import { supportsCleanArea } from "../robot/features";
import type { StoredMap } from "../robot/stored-map";
import { unsupported } from "../unsupported";
import { floorOfArea, floorOfStoredMap, type MapFloorContext } from "./map-to-floor";

const floors = floorsOf(floorRegistry);
const areas = areasOf(areaRegistry);
/** A robot's context; segments link to its maps in the Roomba+ Classic format `<map id>_<region id>`. */
function contextOf(robot: "vacuum" | "mop", mapIds: readonly string[]): MapFloorContext {
  const entityId = robot === "vacuum" ? "vacuum.robot_one" : "vacuum.robot_two";
  const features = new Map(Object.entries(vacuumStates)).get(entityId)?.attributes.supported_features ?? 0;
  return {
    floors,
    areas,
    mapping: readAreaMapping(areaMappingOf(mappingFixtures[robot]), knownAreaIds),
    hasCleanArea: supportsCleanArea(features),
    mapOfSegment: mapOfSegmentIn(mapIds),
  };
}

const { mapA, mapB, mapC, mapD } = fixtureMaps;
const vacuumContext = contextOf("vacuum", [mapA.mapId, mapB.mapId]);
const mopContext = contextOf("mop", [mapC.mapId, mapD.mapId]);
const NO_FLOOR = { kind: "no_floor", reasons: ["assign_area_to_floor_plan", "add_floor_alias"] };

describe("floorOfStoredMap, source 1: the floor plan's own area", () => {
  it("links a floor plan whose own area is studio to upper_floor", () => {
    expect(floorOfStoredMap({ ...mapD, ownAreaId: "studio" }, mopContext)).toEqual({
      kind: "floor",
      floorId: "upper_floor",
      source: 1,
    });
  });

  it("wins over the mapping and the map name", () => {
    expect(floorOfStoredMap({ ...mapA, ownAreaId: "studio" }, vacuumContext)).toEqual({
      kind: "floor",
      floorId: "upper_floor",
      source: 1,
    });
  });

  it("asks for a floor on the area, not for an area, when the plan's own area has no floor", () => {
    expect(floorOfStoredMap({ ...mapD, ownAreaId: "greenhouse" }, mopContext)).toEqual({
      kind: "no_floor",
      reasons: ["assign_floor_to_area", "add_floor_alias"],
    });
  });

  it.each([
    ["an area on no floor", "greenhouse"],
    ["an id that is no known area", "deleted_room"],
  ])("falls through on %s", (_, ownAreaId) => {
    expect(floorOfStoredMap({ ...mapC, ownAreaId }, mopContext)).toEqual({
      kind: "floor",
      floorId: "ground_floor",
      source: 3,
    });
  });

  it("falls through on an area whose floor is not in the floor list", () => {
    const orphan: Area = { areaId: "attic", name: "Attic", aliases: [], floorId: "gone_floor" };
    const context = { ...mopContext, areas: new Map([...areas, ["attic", orphan]]) };
    expect(floorOfStoredMap({ ...mapD, ownAreaId: "attic" }, context)).toEqual({
      kind: "no_floor",
      reasons: ["assign_floor_to_area", "add_floor_alias"],
    });
  });
});

describe("floorOfStoredMap, source 2: the core area mapping", () => {
  it.each([
    [mapA, "ground_floor"],
    [mapB, "upper_floor"],
  ])("links $mapId through the areas of its segments", (map, floorId) => {
    expect(floorOfStoredMap(map, vacuumContext)).toEqual({ kind: "floor", floorId, source: 2 });
  });

  it("yields nothing when the map's areas sit on two floors", () => {
    const mapping = readAreaMapping(
      new Map([
        ["library", ["MapA_q1W2e3_1"]],
        ["studio", ["MapA_q1W2e3_2"]],
      ]),
      knownAreaIds,
    );
    expect(floorOfStoredMap({ ...mapA, mapName: undefined }, { ...vacuumContext, mapping })).toEqual(NO_FLOOR);
  });

  it("ignores an area on no floor", () => {
    const mapping = readAreaMapping(
      new Map([
        ["greenhouse", ["MapB_z9X8c7_1"]],
        ["studio", ["MapB_z9X8c7_2"]],
      ]),
      knownAreaIds,
    );
    expect(floorOfStoredMap(mapB, { ...vacuumContext, mapping })).toMatchObject({ floorId: "upper_floor", source: 2 });
  });

  it.each([
    ["without CLEAN_AREA", { hasCleanArea: false }],
    ["with an absent mapping", { mapping: readAreaMapping(undefined, knownAreaIds) }],
    ["with an unsupported mapping", { mapping: unsupported("too_many_keys") }],
  ])("is skipped %s", (_, change) => {
    expect(floorOfStoredMap({ ...mapB, mapName: undefined }, { ...vacuumContext, ...change })).toEqual(NO_FLOOR);
  });
});

describe("floorOfStoredMap, source 3: the map name", () => {
  it("links the mop robot's « Ground floor » map to ground_floor", () => {
    expect(floorOfStoredMap(mapC, mopContext)).toEqual({ kind: "floor", floorId: "ground_floor", source: 3 });
  });

  it("compares names as the registries do, and matches an alias", () => {
    expect(floorOfStoredMap({ ...mapD, mapName: "ground FLOOR" }, mopContext)).toMatchObject({
      floorId: "ground_floor",
    });
    const aliased = floors.map((f) => (f.floorId === "upper_floor" ? { ...f, aliases: ["Upper level"] } : f));
    expect(floorOfStoredMap(mapD, { ...mopContext, floors: aliased })).toEqual({
      kind: "floor",
      floorId: "upper_floor",
      source: 3,
    });
  });

  it("yields nothing when the name is one floor's name and another floor's alias", () => {
    const clash = floors.map((f) => (f.floorId === "upper_floor" ? { ...f, aliases: ["Ground floor"] } : f));
    expect(floorOfStoredMap(mapC, { ...mopContext, floors: clash })).toEqual(NO_FLOOR);
  });

  it.each([
    ["no name", { mapName: undefined }],
    ["a name equal to the map id", { mapName: "MapC_k4L5m6" }],
  ])("is skipped with %s", (_, change) => {
    const named = floors.map((f) => (f.floorId === "upper_floor" ? { ...f, aliases: ["MapC_k4L5m6"] } : f));
    expect(floorOfStoredMap({ ...mapC, ...change }, { ...mopContext, floors: named })).toEqual(NO_FLOOR);
  });

  it("is skipped for a disabled floor plan", () => {
    expect(floorOfStoredMap({ ...mapC, pictureState: "disabled" }, mopContext).kind).toBe("no_floor");
  });
});

describe("floorOfStoredMap, source 4: no floor", () => {
  it("gives the mop robot's « Upper level » map no floor, with both fixes", () => {
    expect(floorOfStoredMap(mapD, mopContext)).toEqual(NO_FLOOR);
  });

  it("gives a disabled floor plan the same fixes, its picture saying how to enable it", () => {
    const disabled: StoredMap = { ...mapD, pictureState: "disabled", mapName: undefined };
    expect(floorOfStoredMap(disabled, mopContext)).toEqual({
      kind: "no_floor",
      reasons: ["assign_area_to_floor_plan", "add_floor_alias"],
    });
  });

  it("puts no map id, segment id or map name in its reasons", () => {
    expect(JSON.stringify(floorOfStoredMap(mapD, mopContext))).not.toMatch(/Map[A-D]_|Upper level/);
  });
});

describe("floorOfArea", () => {
  it.each([
    ["an area on a listed floor", areas.get("library"), "ground_floor"],
    ["an area on no floor", areas.get("greenhouse"), undefined],
    ["an area whose floor is not listed", { areaId: "x", name: "X", aliases: [], floorId: "gone_floor" }, undefined],
    ["no area", undefined, undefined],
  ])("gives %s its floor or none", (_, area, expected) => {
    expect(floorOfArea(area, floors)).toBe(expected);
  });
});
