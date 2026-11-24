import { withinTextCap } from "../text/limits";
import { type Unsupported, unsupported } from "../unsupported";
import { MAX_AREA_MAPPING_KEYS, MAX_MAPPED_SEGMENTS, MAX_SEGMENTS_PER_AREA } from "./limits";

/**
 * A vacuum's `options.vacuum.area_mapping` (area id to segment ids), already typed by the adapter. Core does not
 * validate it: deleted areas stay as keys, a segment can sit under two areas, and a list can be empty
 * (`docs/research/ha-core-vacuum.md`). `last_seen_segments` is read on its own (`./last-seen.ts`), so refusing one
 * never hides the other (ADR 0002 « Parsing limits » item 3).
 */
export type RawAreaMapping = ReadonlyMap<string, readonly string[]>;

/** `unreadable`: the list could not be read at all (not the documented shape, or not available yet). */
export type AreaMappingFailure =
  | "too_many_keys"
  | "too_many_segments_in_area"
  | "too_many_segments"
  | "text_too_long"
  | "unreadable";

export type SegmentArea =
  | { readonly kind: "one"; readonly areaId: string }
  | { readonly kind: "none" }
  | { readonly kind: "several" };

/** Read it through `areaOfSegment`, `segmentsOfArea` and `areasOnMapping`, which handle missing keys. */
export interface AreaMapping {
  readonly kind: "mapping";
  /** Known areas with at least one segment, in stored order; each list without repeats, in stored order. */
  readonly segmentsByArea: ReadonlyMap<string, readonly string[]>;
  /** Each listed segment's area by ADR 0005 rule 1; a segment missing here has none. */
  readonly areaBySegment: ReadonlyMap<string, SegmentArea>;
}

/**
 * `absent` when core has no mapping yet (core fails with `area_mapping_not_configured`); an empty mapping `{}` is a
 * mapping with no areas, as core treats it.
 */
export type AreaMappingResult = AreaMapping | { readonly kind: "absent" } | Unsupported<AreaMappingFailure>;

const NONE: SegmentArea = Object.freeze({ kind: "none" });
const SEVERAL: SegmentArea = Object.freeze({ kind: "several" });
const NO_SEGMENTS: readonly string[] = Object.freeze([]);

/**
 * ADR 0005 « Room to area » rule 1. Keys that are not known areas and empty lists are ignored; caps are checked on
 * the mapping as stored, before any key is ignored (ADR 0002 « Parsing limits » item 3).
 */
export function readAreaMapping(raw: RawAreaMapping | undefined, areaIds: ReadonlySet<string>): AreaMappingResult {
  if (raw === undefined) return { kind: "absent" };
  const refused = refuseMapping(raw);
  if (refused) return unsupported(refused);

  const segmentsByArea = new Map<string, readonly string[]>();
  const areaBySegment = new Map<string, SegmentArea>();
  for (const [areaId, segmentIds] of raw) {
    if (segmentIds.length === 0 || !areaIds.has(areaId)) continue;
    const unique = [...new Set(segmentIds)];
    segmentsByArea.set(areaId, unique);
    for (const segmentId of unique) {
      areaBySegment.set(segmentId, areaBySegment.has(segmentId) ? SEVERAL : { kind: "one", areaId });
    }
  }
  return { kind: "mapping", segmentsByArea, areaBySegment };
}

export function areaOfSegment(mapping: AreaMapping, segmentId: string): SegmentArea {
  return mapping.areaBySegment.get(segmentId) ?? NONE;
}

export function segmentsOfArea(mapping: AreaMapping, areaId: string): readonly string[] {
  return mapping.segmentsByArea.get(areaId) ?? NO_SEGMENTS;
}

export function areasOnMapping(mapping: AreaMapping): readonly string[] {
  return [...mapping.segmentsByArea.keys()];
}

/** Every segment id listed under a kept area, once each. */
export function segmentsOnMapping(mapping: AreaMapping): Iterable<string> {
  return mapping.areaBySegment.keys();
}

/**
 * The kept areas with at least one segment on a stored map, in stored order; `mapOfSegment` is the adapter's link
 * from a segment id to its map (ADR 0002 « What an adapter reports » item 2).
 */
export function areasOfMap(
  mapping: AreaMapping,
  mapId: string,
  mapOfSegment: (segmentId: string) => string | undefined,
): readonly string[] {
  return areasOnMapping(mapping).filter((areaId) =>
    segmentsOfArea(mapping, areaId).some((segmentId) => mapOfSegment(segmentId) === mapId),
  );
}

function refuseMapping(raw: RawAreaMapping): AreaMappingFailure | undefined {
  if (raw.size > MAX_AREA_MAPPING_KEYS) return "too_many_keys";
  let total = 0;
  for (const [areaId, segmentIds] of raw) {
    if (segmentIds.length > MAX_SEGMENTS_PER_AREA) return "too_many_segments_in_area";
    total += segmentIds.length;
    if (total > MAX_MAPPED_SEGMENTS) return "too_many_segments";
    if (!withinTextCap(areaId) || !segmentIds.every(withinTextCap)) return "text_too_long";
  }
  return undefined;
}
