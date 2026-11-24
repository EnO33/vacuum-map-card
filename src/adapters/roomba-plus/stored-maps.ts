import type { StoredMap } from "../../domain/robot/stored-map";
import type { EntityRegistryEntry } from "../hass/entity-registry";
import type { FrontendHass } from "../hass/frontend-hass";
import { boundedId, isObject, ownValue } from "../hass/own-property";
import { pictureStateOf, stateObjectOf } from "../hass/picture-state";
import { safeMapName } from "./map-name";
import type { RobotEntities } from "./robot-entities";

/**
 * The robot's stored maps: one per floor plan registry entry, enabled or not, in registry order (ADR 0005 « Plan
 * pictures »). A floor plan counts only when its `unique_id` is `<vacuum unique_id>_floor_plan_<map id>` with a
 * non-empty map id; the map id keeps its case (ADR 0002 « What an adapter reports » item 2). No `unique_id` is
 * returned and nothing is logged. A Prime map id holds the robot identifier (`<BLID>-<epoch>`): it leaves the adapter
 * only as `mapId`, which is never logged, shown or put in a reason (`StoredMap`).
 */
export function storedMapsOf(robot: RobotEntities, getHass: () => FrontendHass): readonly StoredMap[] {
  const vacuumUniqueId = robot.vacuum.uniqueId;
  if (vacuumUniqueId === undefined) return [];
  const prefix = `${vacuumUniqueId}_floor_plan_`;
  const states = getHass().states;
  const maps: StoredMap[] = [];
  for (const floorPlan of robot.floorPlans) {
    const mapId = mapIdOf(floorPlan, prefix);
    if (mapId !== undefined) maps.push(storedMap(floorPlan, mapId, vacuumUniqueId, states));
  }
  return maps;
}

/** The non-empty suffix of the floor plan's `unique_id` after `prefix` (the registry parser already caps `unique_id`). */
function mapIdOf(floorPlan: EntityRegistryEntry, prefix: string): string | undefined {
  const uniqueId = floorPlan.uniqueId;
  return uniqueId?.startsWith(prefix) ? boundedId(uniqueId.slice(prefix.length)) : undefined;
}

function storedMap(floorPlan: EntityRegistryEntry, mapId: string, vacuumUniqueId: string, states: unknown): StoredMap {
  const stateObject = floorPlan.disabled ? undefined : stateObjectOf(states, floorPlan.entityId);
  const attributes = stateObject === undefined ? undefined : ownValue(stateObject, "attributes");
  const rawName = isObject(attributes) ? ownValue(attributes, "map_name") : undefined;
  return Object.freeze({
    floorPlanEntityId: floorPlan.entityId,
    mapId,
    mapName: safeMapName(rawName, mapId, vacuumUniqueId),
    pictureState: pictureStateOf(floorPlan, stateObject),
    ownAreaId: floorPlan.areaId,
  });
}
