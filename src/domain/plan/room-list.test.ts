import { describe, expect, it } from "vitest";
import areaRegistry from "../../../test/fixtures/ha-core/area_registry_list.json" with { type: "json" };
import vacuumStates from "../../../test/fixtures/ha-core/hass_states_vacuum_docked.json" with { type: "json" };
import { areaMappingOf, knownAreaIds, mappingFixtures } from "../../../test/helpers/area-mapping";
import { areasOf } from "../../../test/helpers/registry";
import { fixtureMaps, mapOfSegmentIn } from "../../../test/helpers/stored-maps";
import { readAreaMapping } from "../mapping/area-mapping";
import { supportsCleanArea } from "../robot/features";
import { unsupported } from "../unsupported";
import { type RoomListContext, type RoomListRobot, roomListOf } from "./room-list";

const { mapA, mapB, mapC, mapD } = fixtureMaps;
const areas = areasOf(areaRegistry);
const features = new Map(Object.entries(vacuumStates));

function robotOf(entityId: string, mapIds: readonly string[]): RoomListRobot {
  const state = features.get(entityId);
  if (!state) throw new Error(`no fixture state for ${entityId}`);
  return {
    hasCleanArea: supportsCleanArea(state.attributes.supported_features),
    mapOfSegment: mapOfSegmentIn(mapIds),
  };
}

const vacuumRobot = robotOf("vacuum.robot_one", [mapA.mapId, mapB.mapId]);
const mopRobot = robotOf("vacuum.robot_two", [mapC.mapId, mapD.mapId]);
const vacuumContext: RoomListContext = {
  areas,
  mapping: readAreaMapping(areaMappingOf(mappingFixtures.vacuum), knownAreaIds),
};

describe("roomListOf", () => {
  it.each([
    [
      mapA,
      [
        { areaId: "library", name: "Library" },
        { areaId: "workshop", name: "Workshop" },
      ],
    ],
    [
      mapB,
      [
        { areaId: "music_room", name: "Music room" },
        { areaId: "studio", name: "Studio" },
      ],
    ],
  ])("lists the vacuum robot's areas on $mapId", (map, items) => {
    expect(roomListOf(map, vacuumRobot, vacuumContext)).toEqual({ kind: "areas", items });
  });

  it.each([mapC, mapD])("gives the mop robot's $mapId a picture only: no CLEAN_AREA", (map) => {
    const context = { areas, mapping: readAreaMapping(areaMappingOf(mappingFixtures.mop), knownAreaIds) };
    expect(roomListOf(map, mopRobot, context)).toEqual({ kind: "picture_only", reason: "no_clean_area" });
  });

  it.each([
    ["mapping_absent", readAreaMapping(areaMappingOf(mappingFixtures.noMapping), knownAreaIds)],
    ["mapping_unsupported", unsupported("too_many_keys")],
    ["no_area_on_this_map", readAreaMapping(new Map([["library", ["MapB_z9X8c7_1"]]]), knownAreaIds)],
  ])("gives a picture only with %s", (reason, mapping) => {
    expect(roomListOf(mapA, vacuumRobot, { areas, mapping })).toEqual({ kind: "picture_only", reason });
  });

  it("follows the area list order, each area once", () => {
    const mapping = readAreaMapping(
      new Map([
        ["workshop", ["MapA_q1W2e3_2", "MapA_q1W2e3_3"]],
        ["library", ["MapA_q1W2e3_1"]],
      ]),
      knownAreaIds,
    );
    expect(roomListOf(mapA, vacuumRobot, { areas, mapping })).toMatchObject({
      items: [{ areaId: "library" }, { areaId: "workshop" }],
    });
  });

  it("lists an area whose segments are on two maps in both lists", () => {
    const mapping = readAreaMapping(new Map([["studio", ["MapA_q1W2e3_4", "MapB_z9X8c7_2"]]]), knownAreaIds);
    for (const map of [mapA, mapB]) {
      expect(roomListOf(map, vacuumRobot, { areas, mapping })).toEqual({
        kind: "areas",
        items: [{ areaId: "studio", name: "Studio" }],
      });
    }
  });
});
