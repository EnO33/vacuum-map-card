import type { MapFloor } from "../floors/map-to-floor";
import { type AreaMappingResult, segmentsOnMapping } from "../mapping/area-mapping";
import type { LastSeen } from "../mapping/last-seen";
import type { StoredMap } from "../robot/stored-map";

/**
 * What pairing reads from a robot; `app`'s `SourceRobot` (#47) has this shape. `shownMapId` is the stored map the
 * adapter says the rooms map shows (ADR 0002 « What an adapter reports » item 1; Roomba+ Classic: its one stored map).
 */
export interface PairingRobot {
  readonly storedMaps: readonly StoredMap[];
  readonly roomsMap:
    | {
        readonly shownMapId: string | undefined;
        readonly content: { readonly kind: "snapshot" | "no_outlines" | "unsupported" };
      }
    | undefined;
  mapOfSegment(segmentId: string): string | undefined;
  segmentOf(mapId: string, regionId: string): string | undefined;
}

/** Build `mapping` and the mapping `floorOf` reads from one value, so the check and the placement agree. */
export interface PairingContext {
  /** The robot's core mapping and `last_seen_segments` (#46). */
  readonly mapping: AreaMappingResult;
  readonly lastSeen: LastSeen;
  /** Each stored map's floor link (#48, `floorOfStoredMap`), worked out once by the caller. */
  readonly floorOf: (map: StoredMap) => MapFloor;
}

/** Why the rooms map is not paired with a stored map (ADR 0005 « Rooms map pairing » items 1 and 2). Codes only. */
export type UnpairedReason =
  | "no_floor_plan"
  | "several_floor_plans"
  | "shown_map_not_reported"
  | "shown_map_unknown"
  | "floor_plan_unavailable"
  | "unknown_map_segment"
  | "segments_unreadable";

/** Where an unpaired rooms map is shown: on the one floor all stored maps share, or in « no floor » with a note. */
export type UnpairedPlacement =
  | { readonly kind: "floor"; readonly floorId: string }
  | { readonly kind: "no_floor"; readonly reasons: readonly "cannot_tell_shown_map"[] };

export type Pairing =
  | {
      readonly kind: "paired";
      /** Kept only as a value for linking; never shown or put in a reason. */
      readonly mapId: string;
      readonly placement: MapFloor;
      /** The core segment id of a room of the rooms map, from the adapter (`<map id>_<region id>` for Roomba+). */
      readonly segmentIdOf: (regionId: string) => string | undefined;
    }
  | { readonly kind: "unpaired"; readonly placement: UnpairedPlacement; readonly reason: UnpairedReason }
  /** No outlines to show: no pairing and no plan of its own; the reason is kept for the floor model (#51). */
  | { readonly kind: "no_rooms_map"; readonly reason: "absent" | "no_outlines" | "unsupported" };

const CANNOT_TELL: UnpairedPlacement = { kind: "no_floor", reasons: ["cannot_tell_shown_map"] };

/**
 * ADR 0005 « Rooms map pairing ». The rooms map is paired only when the robot has exactly one floor plan, the adapter
 * says the rooms map shows it, no floor plan is `unavailable`, and every segment id of the kept core mapping and of
 * `last_seen_segments` belongs to a known map; an unsupported mapping or `last_seen_segments` cannot be checked, so it
 * blocks pairing. Otherwise the rooms map is its own plan, with no segment ids, on the floor every stored map shares
 * (only when the one failed check is « several floor plans »), or in « no floor ».
 *
 * The caller applies `buildRoomsPlan` first: a snapshot it refuses or finds without rooms has no plan to place.
 */
export function pairRoomsMap(robot: PairingRobot, context: PairingContext): Pairing {
  const { roomsMap } = robot;
  if (roomsMap === undefined) return { kind: "no_rooms_map", reason: "absent" };
  if (roomsMap.content.kind !== "snapshot") return { kind: "no_rooms_map", reason: roomsMap.content.kind };

  const check = checkPairing(robot, context, roomsMap.shownMapId);
  if (typeof check === "string") {
    const placement = check === "several_floor_plans" ? sharedFloor(robot.storedMaps, context.floorOf) : CANNOT_TELL;
    return { kind: "unpaired", placement, reason: check };
  }
  const { mapId } = check;
  const segmentIdOf = (regionId: string) => robot.segmentOf(mapId, regionId);
  return { kind: "paired", mapId, placement: context.floorOf(check), segmentIdOf };
}

/** The shown stored map when every check of ADR 0005 item 1 holds, otherwise the first failed check. */
function checkPairing(
  robot: PairingRobot,
  { mapping, lastSeen }: PairingContext,
  shownMapId: string | undefined,
): StoredMap | UnpairedReason {
  const { storedMaps } = robot;
  if (storedMaps.length === 0) return "no_floor_plan";
  if (storedMaps.some((map) => map.pictureState === "unavailable")) return "floor_plan_unavailable";
  if (mapping.kind === "unsupported" || lastSeen.kind === "unsupported") return "segments_unreadable";
  const mapped = mapping.kind === "mapping" ? segmentsOnMapping(mapping) : [];
  const seen = lastSeen.kind === "names" ? lastSeen.names.keys() : [];
  for (const segmentIds of [mapped, seen]) {
    for (const segmentId of segmentIds) if (robot.mapOfSegment(segmentId) === undefined) return "unknown_map_segment";
  }
  const [only, ...others] = storedMaps;
  if (!only || others.length > 0) return "several_floor_plans";
  if (shownMapId === undefined) return "shown_map_not_reported";
  return shownMapId === only.mapId ? only : "shown_map_unknown";
}

/** The floor every stored map links to, or « no floor » when they differ or one has none. */
function sharedFloor(storedMaps: readonly StoredMap[], floorOf: (map: StoredMap) => MapFloor): UnpairedPlacement {
  const floorIds = storedMaps.map((map) => {
    const floor = floorOf(map);
    return floor.kind === "floor" ? floor.floorId : undefined;
  });
  const [first] = floorIds;
  return first !== undefined && floorIds.every((id) => id === first) ? { kind: "floor", floorId: first } : CANNOT_TELL;
}
