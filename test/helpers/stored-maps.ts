// Test helper: the fixtures' stored maps (map ids from `test/fixtures/roomba-plus/README.md`) and the Roomba+
// Classic segment link `<map id>_<region id>` that an adapter reports (ADR 0002 « What an adapter reports » item 2).
import type { StoredMap } from "../../src/domain/robot/stored-map";
import { withinTextCap } from "../../src/domain/text/limits";
import floorPlanStates from "../fixtures/roomba-plus/hass_states_floor_plans.json" with { type: "json" };

const floorPlanStateOf = new Map(Object.entries(floorPlanStates));

/** A stored map of the fixtures, enabled, with no own area. */
function storedMap(floorPlanEntityId: string, mapId: string): StoredMap {
  const mapName = floorPlanStateOf.get(floorPlanEntityId)?.attributes.map_name;
  return { floorPlanEntityId, mapId, mapName, pictureState: "available", ownAreaId: null };
}

export const fixtureMaps = {
  mapA: storedMap("image.robot_one_floor_plan_mapa_q1w2e3", "MapA_q1W2e3"),
  mapB: storedMap("image.robot_one_floor_plan_mapb_z9x8c7", "MapB_z9X8c7"),
  mapC: storedMap("image.robot_two_floor_plan_mapc_k4l5m6", "MapC_k4L5m6"),
  mapD: storedMap("image.robot_two_floor_plan_mapd_r7t8y9", "MapD_r7T8y9"),
};

/** The map of a segment id among `mapIds`, by the `<map id>_` prefix, longest map id first. */
export function mapOfSegmentIn(mapIds: readonly string[]): (segmentId: string) => string | undefined {
  const longestFirst = [...mapIds].sort((a, b) => b.length - a.length);
  return (segmentId) => longestFirst.find((mapId) => segmentId.startsWith(`${mapId}_`));
}

/** The segment id of a room of a map, or `undefined` when it would exceed the string cap. */
export function segmentIdIn(mapId: string, regionId: string): string | undefined {
  const segmentId = `${mapId}_${regionId}`;
  return withinTextCap(segmentId) ? segmentId : undefined;
}
