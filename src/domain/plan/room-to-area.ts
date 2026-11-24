import { floorOfArea } from "../floors/map-to-floor";
import { type AreaMappingResult, areaOfSegment } from "../mapping/area-mapping";
import type { Area, Floor } from "../registry/types";
import { matchesRegistryName, registryNameKey } from "../text/registry-name";

/**
 * A room linked to an area by the core mapping (rule 1): the only link that may feed ADR 0003 path 1. Necessary, not
 * sufficient: path 1 still checks the robot's `CLEAN_AREA` and ADR 0003's other conditions (#52).
 */
export interface CoreAreaLink {
  readonly kind: "core";
  readonly areaId: string;
}

/** A room linked by name (rule 2): groups robots and places rooms, never feeds `vacuum.clean_area`. */
export interface NameAreaLink {
  readonly kind: "name";
  readonly areaId: string;
}

export type AreaLink = CoreAreaLink | NameAreaLink | { readonly kind: "none" };

/** What a room of a plan is linked to an area with (ADR 0005 « Room to area »). */
export interface RoomAreaContext {
  /** Floors in list order: an area whose floor is not listed counts as on no floor. */
  readonly floors: readonly Floor[];
  readonly areas: ReadonlyMap<string, Area>;
  /** The robot's core mapping (#46). */
  readonly mapping: AreaMappingResult;
  /** The plan's floor, or `undefined` for the « no floor » group (#48, #49). */
  readonly planFloorId: string | undefined;
  /** The segment id of a room, only for a paired rooms map (#49); `undefined` otherwise. */
  readonly segmentIdOf: ((regionId: string) => string | undefined) | undefined;
}

const NONE: AreaLink = Object.freeze({ kind: "none" });

/**
 * At most one area for a room: its segment under exactly one known area in the core mapping (rule 1, paired plans
 * only), else its name equal to exactly one area's name or alias as the registries compare names, among areas on the
 * plan's floor or on no floor; for a plan in « no floor », among areas on no floor (rule 2). Otherwise none.
 */
export function areaOfRoom(
  room: { readonly regionId: string; readonly name: string },
  context: RoomAreaContext,
): AreaLink {
  return byCoreMapping(room.regionId, context) ?? byName(room.name, context);
}

/** Rule 1; the area must also be in `areas` now, so a mapping read before an area was deleted never links to it. */
function byCoreMapping(regionId: string, { areas, mapping, segmentIdOf }: RoomAreaContext): CoreAreaLink | undefined {
  if (segmentIdOf === undefined || mapping.kind !== "mapping") return undefined;
  const segmentId = segmentIdOf(regionId);
  const area = segmentId === undefined ? undefined : areaOfSegment(mapping, segmentId);
  return area?.kind === "one" && areas.has(area.areaId) ? { kind: "core", areaId: area.areaId } : undefined;
}

function byName(name: string, { floors, areas, planFloorId }: RoomAreaContext): AreaLink {
  const key = registryNameKey(name);
  const named = [...areas.values()].filter(
    (area) => onPlanFloor(floorOfArea(area, floors), planFloorId) && matchesRegistryName(key, area),
  );
  const [area, ...others] = named;
  return area && others.length === 0 ? { kind: "name", areaId: area.areaId } : NONE;
}

/** An area on no floor always counts; one on a floor counts only for a plan on that same floor. */
function onPlanFloor(areaFloorId: string | undefined, planFloorId: string | undefined): boolean {
  return areaFloorId === undefined || areaFloorId === planFloorId;
}
