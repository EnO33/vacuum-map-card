import { type AreaMappingResult, areaOfSegment, segmentsOfArea } from "../mapping/area-mapping";
import { type LastSeen, lastSeenName } from "../mapping/last-seen";

/**
 * What path 1 is asked about (ADR 0003 « Path 1 », « Where it applies »): an area item of a room list, with its area,
 * or a room of a paired rooms map, by its segment id only (`segmentIdOf`, #49). A room of an unpaired rooms map is
 * not asked about. The room's area comes from this robot's own mapping (condition 4), so a name link (#50) can never
 * be passed here.
 */
export type PathOneItem =
  | { readonly kind: "area"; readonly areaId: string }
  | { readonly kind: "room"; readonly segmentId: string };

/** A paired rooms map's rooms (#49), so condition 6 names a segment from the regions currently on it. */
export interface PairedRooms {
  readonly mapId: string;
  readonly segmentIdOf: (regionId: string) => string | undefined;
  readonly rooms: readonly { readonly regionId: string; readonly name: string }[];
}

export interface PathOneContext {
  /** Condition 1: `supported_features & CLEAN_AREA` (`supportsCleanArea`). */
  readonly hasCleanArea: boolean;
  /** Condition 2: `hass.services.vacuum.clean_area` exists. */
  readonly hasCleanAreaService: boolean;
  /** Condition 3: this robot's core mapping (#46). */
  readonly mapping: AreaMappingResult;
  readonly lastSeen: LastSeen;
  /** The stored map of a segment id, from the robot's adapter (ADR 0002 item 2). */
  readonly mapOfSegment: (segmentId: string) => string | undefined;
  /** Condition 6: a `segments_changed` repair issue is open for the robot. */
  readonly segmentsChangedOpen: boolean;
  readonly pairedRooms: PairedRooms | undefined;
}

/** The first failing condition of ADR 0003 « Path 1 », in its order. Codes only: never a map or segment id. */
export type PathOneRefusal =
  | "no_clean_area"
  | "service_missing"
  | "mapping_absent"
  | "mapping_unsupported"
  | "area_not_mapped"
  | "no_core_area"
  | "several_areas"
  | "area_spans_maps"
  | "segment_map_unknown"
  | "segment_unnamed"
  | "segments_changed_open";

export type PathOne =
  | {
      readonly kind: "path1";
      readonly areaId: string;
      /** Every room the call will clean, in stored order, for the confirmation (ADR 0003 « Confirmation »). */
      readonly roomNames: readonly string[];
      /** Kept only as a value for linking; never shown or put in a reason. */
      readonly mapId: string;
    }
  | { readonly kind: "refused"; readonly reason: PathOneRefusal };

/**
 * Whether `vacuum.clean_area` applies to an item for one robot, checking ADR 0003 « Path 1 » conditions 1 to 6 in
 * order. Refused for an area item, the item is not startable on this robot; refused for a room, #53 tries path 2.
 */
export function pathOne(item: PathOneItem, context: PathOneContext): PathOne {
  if (!context.hasCleanArea) return refused("no_clean_area");
  if (!context.hasCleanAreaService) return refused("service_missing");
  const { mapping } = context;
  if (mapping.kind === "absent") return refused("mapping_absent");
  if (mapping.kind === "unsupported") return refused("mapping_unsupported");

  const area = areaOf(item, mapping, context.pairedRooms);
  if (area.kind === "refused") return area;
  const segmentIds = segmentsOfArea(mapping, area.areaId);
  const [first, ...rest] = segmentIds;
  const mapId = first === undefined ? undefined : context.mapOfSegment(first);
  if (mapId === undefined) return refused("segment_map_unknown");
  for (const segmentId of rest) {
    const map = context.mapOfSegment(segmentId);
    if (map === undefined) return refused("segment_map_unknown");
    if (map !== mapId) return refused("area_spans_maps");
  }

  const nameOf = namesFor(mapId, context);
  const roomNames: string[] = [];
  for (const segmentId of segmentIds) {
    const name = nameOf(segmentId);
    if (name === undefined || name.trim() === "") return refused("segment_unnamed");
    roomNames.push(name);
  }
  if (context.segmentsChangedOpen) return refused("segments_changed_open");
  return { kind: "path1", areaId: area.areaId, roomNames, mapId };
}

/** Conditions 3 (an area item) and 4 (a room): the area, or why there is none. */
function areaOf(
  item: PathOneItem,
  mapping: Extract<AreaMappingResult, { kind: "mapping" }>,
  pairedRooms: PairedRooms | undefined,
): { readonly kind: "area"; readonly areaId: string } | Extract<PathOne, { kind: "refused" }> {
  if (item.kind === "area") {
    return segmentsOfArea(mapping, item.areaId).length > 0 ? item : refused("area_not_mapped");
  }
  // A room is asked about only on this robot's paired rooms map (ADR 0003 « Where it applies »).
  if (pairedRooms === undefined) return refused("no_core_area");
  const area = areaOfSegment(mapping, item.segmentId);
  if (area.kind === "one") return { kind: "area", areaId: area.areaId };
  return refused(area.kind === "several" ? "several_areas" : "no_core_area");
}

/**
 * Condition 6: a segment of the paired rooms map is named only by a region currently on it (a vanished region is
 * never named from `last_seen_segments`); any other segment by its `last_seen_segments` name, exactly as stored. An
 * unsupported or absent `last_seen_segments` names nothing, so its segments are `segment_unnamed`; so is a blank
 * name, which the confirmation could not show. A zone segment of the paired map is never a region, so never named.
 */
function namesFor(mapId: string, { pairedRooms, lastSeen }: PathOneContext): (segmentId: string) => string | undefined {
  if (pairedRooms === undefined || pairedRooms.mapId !== mapId) return (segmentId) => lastSeenName(lastSeen, segmentId);
  const names = new Map<string, string>();
  for (const room of pairedRooms.rooms) {
    const segmentId = pairedRooms.segmentIdOf(room.regionId);
    if (segmentId !== undefined) names.set(segmentId, room.name);
  }
  return (segmentId) => names.get(segmentId);
}

function refused(reason: PathOneRefusal): Extract<PathOne, { kind: "refused" }> {
  return { kind: "refused", reason };
}
