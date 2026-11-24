import { describe, expect, it, vi } from "vitest";
import areaRegistry from "../../../test/fixtures/ha-core/area_registry_list.json" with { type: "json" };
import floorRegistry from "../../../test/fixtures/ha-core/floor_registry_list.json" with { type: "json" };
import { areaMappingOf, knownAreaIds, lastSeenOf, mappingFixtures } from "../../../test/helpers/area-mapping";
import { areasOf, floorsOf } from "../../../test/helpers/registry";
import { fixtureMaps, mapOfSegmentIn, segmentIdIn } from "../../../test/helpers/stored-maps";
import { floorOfStoredMap, type MapFloorContext } from "../floors/map-to-floor";
import { type AreaMappingResult, readAreaMapping } from "../mapping/area-mapping";
import { type LastSeen, readLastSeen } from "../mapping/last-seen";
import type { StoredMap } from "../robot/stored-map";
import { unsupported } from "../unsupported";
import { type PairingContext, type PairingRobot, pairRoomsMap } from "./pairing";

const { mapA, mapB, mapC } = fixtureMaps;
const floors = floorsOf(floorRegistry);
const areas = areasOf(areaRegistry);

/** A context whose floor links (#48) read the same mapping and segment links as the robot. */
function contextOf(mapping: AreaMappingResult, lastSeen: LastSeen, mapIds: readonly string[]): PairingContext {
  const links: MapFloorContext = { floors, areas, mapping, hasCleanArea: true, mapOfSegment: mapOfSegmentIn(mapIds) };
  return { mapping, lastSeen, floorOf: (map) => floorOfStoredMap(map, links) };
}

/** The vacuum robot's context: the fixture mapping and `last_seen_segments`, on maps A and B. */
const context = contextOf(
  readAreaMapping(areaMappingOf(mappingFixtures.vacuum), knownAreaIds),
  readLastSeen(lastSeenOf(mappingFixtures.vacuum)),
  [mapA.mapId, mapB.mapId],
);

/** A context whose mapping and last seen segments all sit on MapA, as for a one-map robot. */
const mapAOnly = contextOf(
  readAreaMapping(new Map([["library", ["MapA_q1W2e3_1"]]]), knownAreaIds),
  readLastSeen([{ id: "MapA_q1W2e3_1", name: "Library" }]),
  [mapA.mapId],
);

/** A robot with these stored maps; the adapter reports the shown map only for a single stored map. */
function robot(storedMaps: readonly StoredMap[], change: Partial<PairingRobot> = {}): PairingRobot {
  const [only, ...others] = storedMaps;
  return {
    storedMaps,
    roomsMap: { shownMapId: only && others.length === 0 ? only.mapId : undefined, content: { kind: "snapshot" } },
    mapOfSegment: mapOfSegmentIn(storedMaps.map((m) => m.mapId)),
    segmentOf: segmentIdIn,
    ...change,
  };
}

describe("pairRoomsMap, paired", () => {
  it("pairs a single available floor plan whose segments are all on its map", () => {
    const pairing = pairRoomsMap(robot([mapA]), mapAOnly);
    expect(pairing).toMatchObject({
      kind: "paired",
      mapId: "MapA_q1W2e3",
      placement: { kind: "floor", floorId: "ground_floor", source: 2 },
    });
    if (pairing.kind !== "paired") throw new Error(pairing.kind);
    expect(pairing.segmentIdOf("3")).toBe("MapA_q1W2e3_3");
  });

  it("still pairs a single disabled floor plan, whose state cannot be checked", () => {
    const disabled: StoredMap = { ...mapA, pictureState: "disabled", mapName: undefined };
    expect(pairRoomsMap(robot([disabled]), mapAOnly).kind).toBe("paired");
  });

  it("places a paired map without a floor in « no floor » with the floor link's reasons", () => {
    const noMapping = contextOf(readAreaMapping(undefined, knownAreaIds), mapAOnly.lastSeen, [mapA.mapId]);
    expect(pairRoomsMap(robot([{ ...mapA, mapName: "Attic" }]), noMapping)).toMatchObject({
      kind: "paired",
      placement: { kind: "no_floor", reasons: ["assign_area_to_floor_plan", "add_floor_alias"] },
    });
  });
});

describe("pairRoomsMap, unpaired", () => {
  it.each([
    ["no floor plan", robot([]), mapAOnly, "no_floor_plan"],
    [
      "one unavailable floor plan",
      robot([{ ...mapA, pictureState: "unavailable" }]),
      mapAOnly,
      "floor_plan_unavailable",
    ],
    [
      "a mapping segment of an unknown map",
      robot([mapA]),
      { ...mapAOnly, mapping: context.mapping },
      "unknown_map_segment",
    ],
    [
      "a last seen segment of an unknown map",
      robot([mapA]),
      { ...mapAOnly, lastSeen: context.lastSeen },
      "unknown_map_segment",
    ],
    [
      "an unsupported mapping",
      robot([mapA]),
      { ...mapAOnly, mapping: unsupported("too_many_keys") },
      "segments_unreadable",
    ],
    [
      "unsupported last seen segments",
      robot([mapA]),
      { ...mapAOnly, lastSeen: unsupported("duplicate_segment_id") },
      "segments_unreadable",
    ],
    [
      "one floor plan the adapter cannot name as shown",
      robot([mapA], { roomsMap: { shownMapId: undefined, content: { kind: "snapshot" } } }),
      mapAOnly,
      "shown_map_not_reported",
    ],
    [
      "a reported map that is not its floor plan",
      robot([mapA], { roomsMap: { shownMapId: "MapZ_none", content: { kind: "snapshot" } } }),
      mapAOnly,
      "shown_map_unknown",
    ],
  ])("does not pair with %s", (_, r, c, reason) => {
    expect(pairRoomsMap(r, c)).toMatchObject({ kind: "unpaired", reason });
  });

  it("does not pair several floor plans even when the adapter reports a shown map", () => {
    const reported = robot([mapA, mapB], { roomsMap: { shownMapId: mapA.mapId, content: { kind: "snapshot" } } });
    expect(pairRoomsMap(reported, context)).toMatchObject({ kind: "unpaired", reason: "several_floor_plans" });
  });

  it("puts it in « no floor » when one of several stored maps has no floor", () => {
    // MapB, renamed and with no segment link for the floor model, has no floor; MapA is on ground_floor.
    const attic: StoredMap = { ...mapB, mapName: "Attic" };
    const floorLinksOnA = contextOf(context.mapping, readLastSeen(undefined), [mapA.mapId]);
    const twoMaps = robot([mapA, attic], { mapOfSegment: mapOfSegmentIn([mapA.mapId, mapB.mapId]) });
    expect(pairRoomsMap(twoMaps, floorLinksOnA)).toMatchObject({
      kind: "unpaired",
      reason: "several_floor_plans",
      placement: { kind: "no_floor", reasons: ["cannot_tell_shown_map"] },
    });
  });

  it("puts the vacuum robot's rooms map in « no floor »: its two maps are on two floors", () => {
    expect(pairRoomsMap(robot([mapA, mapB]), context)).toEqual({
      kind: "unpaired",
      reason: "several_floor_plans",
      placement: { kind: "no_floor", reasons: ["cannot_tell_shown_map"] },
    });
  });

  it("places it on the floor every stored map links to", () => {
    const groundB: StoredMap = { ...mapB, ownAreaId: "library" };
    expect(pairRoomsMap(robot([mapA, groundB]), context)).toMatchObject({
      kind: "unpaired",
      placement: { kind: "floor", floorId: "ground_floor" },
    });
  });

  it("puts it in « no floor » when one of several floor plans is unavailable, even if the others agree", () => {
    const maps: StoredMap[] = [mapA, { ...mapB, ownAreaId: "library" }, { ...mapC, pictureState: "unavailable" }];
    expect(pairRoomsMap(robot(maps), context)).toMatchObject({
      kind: "unpaired",
      reason: "floor_plan_unavailable",
      placement: { kind: "no_floor", reasons: ["cannot_tell_shown_map"] },
    });
  });

  it("never asks the adapter for segment ids of an unpaired rooms map", () => {
    const segmentOf = vi.fn((mapId: string, regionId: string) => `${mapId}_${regionId}`);
    const pairing = pairRoomsMap(robot([mapA, mapB], { segmentOf }), context);
    expect(pairing.kind).toBe("unpaired");
    expect(segmentOf).not.toHaveBeenCalled();
  });

  it("puts no map id in a reason", () => {
    const text = JSON.stringify(pairRoomsMap(robot([mapA, mapB]), context));
    expect(text).not.toMatch(/Map[A-Z]_/);
  });
});

describe("pairRoomsMap, no rooms map", () => {
  const roomsMaps: [string, PairingRobot["roomsMap"]][] = [
    ["absent", undefined],
    ["no_outlines", { shownMapId: "MapA_q1W2e3", content: { kind: "no_outlines" } }],
    ["unsupported", { shownMapId: "MapA_q1W2e3", content: { kind: "unsupported" } }],
  ];

  it.each(roomsMaps)("gives no pairing and no plan when the rooms map is %s", (reason, roomsMap) => {
    expect(pairRoomsMap(robot([mapA], { roomsMap }), mapAOnly)).toEqual({ kind: "no_rooms_map", reason });
  });
});
