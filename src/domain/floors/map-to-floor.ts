import { type AreaMappingResult, areasOfMap } from "../mapping/area-mapping";
import type { Area, Floor } from "../registry/types";
import type { StoredMap } from "../robot/stored-map";
import { matchesRegistryName, registryNameKey } from "../text/registry-name";

/** What a robot's stored maps are linked to floors with (ADR 0005 « Map to floor »). */
export interface MapFloorContext {
  /** Floors in `config/floor_registry/list` order. */
  readonly floors: readonly Floor[];
  readonly areas: ReadonlyMap<string, Area>;
  /** The robot's core mapping (#46). */
  readonly mapping: AreaMappingResult;
  readonly hasCleanArea: boolean;
  /** The stored map a segment id belongs to, from the robot's adapter (ADR 0002 item 2). */
  readonly mapOfSegment: (segmentId: string) => string | undefined;
}

/**
 * Why a plan has no floor, as the fix the user can make in Home Assistant (ADR 0005 « Map to floor » source 4).
 * A disabled floor plan says how to enable it in place of its picture (« Plan pictures » item 5), not here. Codes only: never a map id, segment id or map name.
 */
export type NoFloorReason =
  /** The floor plan entity has no area. */
  | "assign_area_to_floor_plan"
  /** The floor plan entity's area is on no listed floor. */
  | "assign_floor_to_area"
  | "add_floor_alias";

export type MapFloor =
  | { readonly kind: "floor"; readonly floorId: string; readonly source: 1 | 2 | 3 }
  | { readonly kind: "no_floor"; readonly reasons: readonly NoFloorReason[] };

type Source = readonly [1 | 2 | 3, (map: StoredMap, context: MapFloorContext) => ReadonlySet<string>];

const SOURCES: readonly Source[] = [
  [1, fromOwnArea],
  [2, fromMapping],
  [3, fromMapName],
];

/**
 * At most one floor for a stored map: the floor plan's own area (1), the areas of its segments in the core mapping
 * (2), its name as one floor's name or alias (3); the first source that yields exactly one floor wins, and later
 * sources are not read. Otherwise no floor, with the fixes (4): the plan is shown in the « no floor » group.
 */
export function floorOfStoredMap(map: StoredMap, context: MapFloorContext): MapFloor {
  for (const [source, floorsOf] of SOURCES) {
    const [floorId, ...others] = floorsOf(map, context);
    if (floorId !== undefined && others.length === 0) return { kind: "floor", floorId, source };
  }
  const reasons: NoFloorReason[] = [
    map.ownAreaId === null ? "assign_area_to_floor_plan" : "assign_floor_to_area",
    "add_floor_alias",
  ];
  return { kind: "no_floor", reasons };
}

/**
 * The floor of an area, or `undefined` when it has none or its floor is not in the list: an area whose floor was
 * deleted counts as an area on no floor (ADR 0005 « Floors » item 2).
 */
export function floorOfArea(area: Area | undefined, floors: readonly Floor[]): string | undefined {
  const floorId = area?.floorId;
  return floorId && floors.some((floor) => floor.floorId === floorId) ? floorId : undefined;
}

/** Source 1: the floor plan entity's own registry area, never the device's. */
function fromOwnArea(map: StoredMap, { areas, floors }: MapFloorContext): ReadonlySet<string> {
  const floorId = map.ownAreaId === null ? undefined : floorOfArea(areas.get(map.ownAreaId), floors);
  return new Set(floorId ? [floorId] : []);
}

/** Source 2: the floors of the areas the core mapping assigns to this map's segments; areas on no floor ignored. */
function fromMapping(map: StoredMap, context: MapFloorContext): ReadonlySet<string> {
  const { areas, floors, mapping, hasCleanArea, mapOfSegment } = context;
  if (!hasCleanArea || mapping.kind !== "mapping") return new Set();
  const floorIds = areasOfMap(mapping, map.mapId, mapOfSegment).map((areaId) => floorOfArea(areas.get(areaId), floors));
  return new Set(floorIds.filter((floorId) => floorId !== undefined));
}

/** Source 3: the map name, compared as the registries compare names; only for an enabled floor plan. */
function fromMapName(map: StoredMap, { floors }: MapFloorContext): ReadonlySet<string> {
  const { mapName } = map;
  if (map.pictureState === "disabled" || mapName === undefined || mapName === map.mapId) return new Set();
  const key = registryNameKey(mapName);
  const named = floors.filter((floor) => matchesRegistryName(key, floor));
  return new Set(named.map((floor) => floor.floorId));
}
