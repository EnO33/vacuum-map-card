import { type AreaMappingResult, areasOfMap } from "../mapping/area-mapping";
import type { Area } from "../registry/types";
import type { StoredMap } from "../robot/stored-map";

/** What a room list reads from a robot; `app`'s robots provide it with `supportsCleanArea` (#48). */
export interface RoomListRobot {
  readonly hasCleanArea: boolean;
  mapOfSegment(segmentId: string): string | undefined;
}

export interface RoomListContext {
  /** Areas in `HassPort.areas()` order. */
  readonly areas: ReadonlyMap<string, Area>;
  /** The robot's core mapping (#46). */
  readonly mapping: AreaMappingResult;
}

/** Why a plan without outlines shows its picture only. Codes only. */
export type PictureOnlyReason = "no_clean_area" | "mapping_absent" | "mapping_unsupported" | "no_area_on_this_map";

export interface RoomListItem {
  readonly areaId: string;
  readonly name: string;
}

export type RoomList =
  | { readonly kind: "areas"; readonly items: readonly RoomListItem[] }
  | { readonly kind: "picture_only"; readonly reason: PictureOnlyReason };

/**
 * ADR 0005 « Room lists »: a plan without outlines lists the areas the robot's core mapping assigns to that map's
 * segments, each once, in area list order; each is offered through path 1, subject to ADR 0003's checks (#52). A robot
 * without `CLEAN_AREA` has no room names for that map, so its plan shows its picture only.
 */
export function roomListOf(map: StoredMap, robot: RoomListRobot, { areas, mapping }: RoomListContext): RoomList {
  if (!robot.hasCleanArea) return pictureOnly("no_clean_area");
  if (mapping.kind === "absent") return pictureOnly("mapping_absent");
  if (mapping.kind === "unsupported") return pictureOnly("mapping_unsupported");
  const onMap = new Set(areasOfMap(mapping, map.mapId, (segmentId) => robot.mapOfSegment(segmentId)));
  const items = [...areas.values()]
    .filter((area) => onMap.has(area.areaId))
    .map((area) => ({ areaId: area.areaId, name: area.name }));
  return items.length > 0 ? { kind: "areas", items } : pictureOnly("no_area_on_this_map");
}

function pictureOnly(reason: PictureOnlyReason): RoomList {
  return { kind: "picture_only", reason };
}
