import { withinTextCap } from "../../domain/text/limits";

/** A robot's segment links, bound to its own stored map ids. */
export interface SegmentLinks {
  mapOfSegment(segmentId: string): string | undefined;
  segmentOf(mapId: string, regionId: string): string | undefined;
}

/**
 * Roomba+ Classic segment ids are `<map id>_<region id>` (ADR 0002 « What an adapter reports » item 2). A map id
 * holds `_`, so a segment id is never split: it is matched against the robot's own map ids, longest first, and needs
 * a non-empty rest. A segment id is built only from one of those map ids, within the 255 cap (never cut), and only
 * when it reads back to the same map (ADR 0003 « Checks before calling »).
 */
export function segmentLinks(mapIds: readonly string[]): SegmentLinks {
  const longestFirst = [...mapIds].sort((a, b) => b.length - a.length);
  const known = new Set(mapIds);
  const mapOfSegment = (segmentId: string): string | undefined =>
    longestFirst.find((mapId) => segmentId.length > mapId.length + 1 && segmentId.startsWith(`${mapId}_`));
  return {
    mapOfSegment,
    segmentOf(mapId, regionId) {
      if (!known.has(mapId) || regionId === "") return undefined;
      const segmentId = `${mapId}_${regionId}`;
      return withinTextCap(segmentId) && mapOfSegment(segmentId) === mapId ? segmentId : undefined;
    },
  };
}
