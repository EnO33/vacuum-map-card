import { describe, expect, expectTypeOf, it } from "vitest";
import vacuumStates from "../../../test/fixtures/ha-core/hass_states_vacuum_docked.json" with { type: "json" };
import { areaMappingOf, knownAreaIds, lastSeenOf, mappingFixtures } from "../../../test/helpers/area-mapping";
import { mapOfSegmentIn, segmentIdIn } from "../../../test/helpers/stored-maps";
import { readAreaMapping } from "../mapping/area-mapping";
import { readLastSeen } from "../mapping/last-seen";
import { supportsCleanArea } from "../robot/features";
import { unsupported } from "../unsupported";
import { type PathOneContext, type PathOneItem, type PathOneRefusal, pathOne } from "./path-one";

const features = (entityId: "vacuum.robot_one" | "vacuum.robot_two") =>
  supportsCleanArea(vacuumStates[entityId].attributes.supported_features);

/** The vacuum robot of the fixtures: `CLEAN_AREA`, its mapping and `last_seen_segments`, two stored maps. */
const vacuum: PathOneContext = {
  hasCleanArea: features("vacuum.robot_one"),
  hasCleanAreaService: true,
  mapping: readAreaMapping(areaMappingOf(mappingFixtures.vacuum), knownAreaIds),
  lastSeen: readLastSeen(lastSeenOf(mappingFixtures.vacuum)),
  mapOfSegment: mapOfSegmentIn(["MapA_q1W2e3", "MapB_z9X8c7"]),
  segmentsChangedOpen: false,
  pairedRooms: undefined,
};

const area = (areaId: string): PathOneItem => ({ kind: "area", areaId });
const withMapping = (entries: [string, string[]][]) => readAreaMapping(new Map(entries), knownAreaIds);

describe("pathOne on the fixtures", () => {
  it.each([
    ["workshop", ["Workshop"]],
    ["studio", ["Studio"]],
  ])("cleans the area item %s through vacuum.clean_area", (areaId, roomNames) => {
    expect(pathOne(area(areaId), vacuum)).toMatchObject({ kind: "path1", areaId, roomNames });
  });

  it("names the rooms in the mapping's stored order", () => {
    const reversed = { ...vacuum, mapping: withMapping([["studio", ["MapB_z9X8c7_2", "MapB_z9X8c7_1"]]]) };
    expect(pathOne(area("studio"), reversed)).toMatchObject({ roomNames: ["Studio", "Gallery"] });
  });

  it("names the map the area's segments are on, for linking", () => {
    expect(pathOne(area("library"), vacuum)).toEqual({
      kind: "path1",
      areaId: "library",
      roomNames: ["Library"],
      mapId: "MapA_q1W2e3",
    });
  });

  it("refuses the mop robot: no CLEAN_AREA", () => {
    const mop: PathOneContext = {
      ...vacuum,
      hasCleanArea: features("vacuum.robot_two"),
      mapping: readAreaMapping(areaMappingOf(mappingFixtures.mop), knownAreaIds),
      lastSeen: readLastSeen(lastSeenOf(mappingFixtures.mop)),
    };
    expect(pathOne(area("library"), mop)).toEqual({ kind: "refused", reason: "no_clean_area" });
  });

  it("refuses without a mapping", () => {
    const noMapping = { ...vacuum, mapping: readAreaMapping(areaMappingOf(mappingFixtures.noMapping), knownAreaIds) };
    expect(pathOne(area("library"), noMapping)).toEqual({ kind: "refused", reason: "mapping_absent" });
  });

  it("never offers a key that is no longer an area", () => {
    const deleted = { ...vacuum, mapping: readAreaMapping(areaMappingOf(mappingFixtures.deletedArea), knownAreaIds) };
    expect(pathOne(area("deleted_room"), deleted)).toEqual({ kind: "refused", reason: "area_not_mapped" });
  });
});

describe("pathOne refusals, first failing condition in ADR order", () => {
  it.each<[string, Partial<PathOneContext>, PathOneItem, PathOneRefusal]>([
    ["the service missing", { hasCleanAreaService: false }, area("library"), "service_missing"],
    [
      "an unsupported mapping",
      { mapping: { kind: "unsupported", reason: "too_many_keys" } },
      area("library"),
      "mapping_unsupported",
    ],
    ["an empty mapping", { mapping: withMapping([]) }, area("library"), "area_not_mapped"],
    [
      "an area on two maps",
      { mapping: withMapping([["studio", ["MapA_q1W2e3_4", "MapB_z9X8c7_2"]]]) },
      area("studio"),
      "area_spans_maps",
    ],
    [
      "a segment of no known map",
      { mapping: withMapping([["studio", ["MapZ_none_1"]]]) },
      area("studio"),
      "segment_map_unknown",
    ],
    [
      "a later segment of no known map",
      { mapping: withMapping([["studio", ["MapB_z9X8c7_2", "MapZ_none_1"]]]) },
      area("studio"),
      "segment_map_unknown",
    ],
    [
      "a segment not in last_seen_segments",
      { mapping: withMapping([["studio", ["MapB_z9X8c7_2", "MapB_z9X8c7_9"]]]) },
      area("studio"),
      "segment_unnamed",
    ],
    ["an open segments_changed repair issue", { segmentsChangedOpen: true }, area("library"), "segments_changed_open"],
    ["absent last_seen_segments", { lastSeen: readLastSeen(undefined) }, area("library"), "segment_unnamed"],
    [
      "unsupported last_seen_segments",
      { lastSeen: unsupported("too_many_entries") },
      area("library"),
      "segment_unnamed",
    ],
    [
      "a blank last seen name",
      { lastSeen: readLastSeen([{ id: "MapA_q1W2e3_1", name: "  " }]) },
      area("library"),
      "segment_unnamed",
    ],
    [
      "the service missing before an absent mapping",
      { hasCleanAreaService: false, mapping: readAreaMapping(undefined, knownAreaIds) },
      area("library"),
      "service_missing",
    ],
    [
      "an area on two maps before an unnamed segment",
      { mapping: withMapping([["studio", ["MapA_q1W2e3_9", "MapB_z9X8c7_9"]]]) },
      area("studio"),
      "area_spans_maps",
    ],
    [
      "an unnamed segment before an open repair issue",
      { mapping: withMapping([["studio", ["MapB_z9X8c7_9"]]]), segmentsChangedOpen: true },
      area("studio"),
      "segment_unnamed",
    ],
    [
      "no CLEAN_AREA, before anything else",
      { hasCleanArea: false, hasCleanAreaService: false },
      area("library"),
      "no_clean_area",
    ],
  ])("refuses with %s", (_, change, item, reason) => {
    expect(pathOne(item, { ...vacuum, ...change })).toEqual({ kind: "refused", reason });
  });
});

describe("pathOne for a room of a paired rooms map", () => {
  /** A one-map robot whose rooms map is paired with MapA and shows regions 1 and 3. */
  const paired: PathOneContext = {
    ...vacuum,
    mapping: withMapping([
      ["library", ["MapA_q1W2e3_1", "MapA_q1W2e3_3"]],
      ["workshop", ["MapA_q1W2e3_1", "MapA_q1W2e3_2"]],
    ]),
    mapOfSegment: mapOfSegmentIn(["MapA_q1W2e3"]),
    pairedRooms: {
      mapId: "MapA_q1W2e3",
      segmentIdOf: (regionId) => segmentIdIn("MapA_q1W2e3", regionId),
      rooms: [
        { regionId: "3", name: "Nook" },
        { regionId: "1", name: "Reading room" },
      ],
    },
  };
  const room = (regionId: string): PathOneItem => ({ kind: "room", regionId });

  it("cleans the room's core area, naming every room of it from the rooms map", () => {
    expect(pathOne(room("3"), paired)).toEqual({
      kind: "path1",
      areaId: "library",
      roomNames: ["Reading room", "Nook"],
      mapId: "MapA_q1W2e3",
    });
  });

  it.each([
    ["a segment under two areas", room("1"), "several_areas"],
    ["a segment under no area", room("7"), "no_core_area"],
  ])("refuses %s", (_, item, reason) => {
    expect(pathOne(item, paired)).toEqual({ kind: "refused", reason });
  });

  it("never names a zone of the paired map, which is not a region", () => {
    const withZone = { ...paired, mapping: withMapping([["library", ["MapA_q1W2e3_1", "MapA_q1W2e3_zid_0"]]]) };
    expect(pathOne(room("1"), withZone)).toEqual({ kind: "refused", reason: "segment_unnamed" });
  });

  it("does not answer for a room whose segment id the adapter cannot build", () => {
    const { pairedRooms } = paired;
    if (pairedRooms === undefined) throw new Error("paired");
    const capped = { ...paired, pairedRooms: { ...pairedRooms, segmentIdOf: () => undefined } };
    expect(pathOne(room("3"), capped)).toEqual({ kind: "refused", reason: "no_core_area" });
  });

  it("does not answer for a room when the rooms map is not paired", () => {
    expect(pathOne(room("3"), { ...paired, pairedRooms: undefined })).toEqual({
      kind: "refused",
      reason: "no_core_area",
    });
  });

  it("does not name a segment of the paired map from last_seen_segments when its region is gone", () => {
    const gone = {
      ...paired,
      mapping: withMapping([["library", ["MapA_q1W2e3_1", "MapA_q1W2e3_2"]]]),
      lastSeen: readLastSeen([{ id: "MapA_q1W2e3_2", name: "Workshop" }]),
    };
    expect(pathOne(room("1"), gone)).toEqual({ kind: "refused", reason: "segment_unnamed" });
  });

  it("accepts no name link where a room is expected", () => {
    expectTypeOf<{ kind: "room"; areaId: string }>().not.toExtend<PathOneItem>();
    expectTypeOf<{ kind: "room"; segmentId: string }>().not.toExtend<PathOneItem>();
  });
});

describe("pathOne results", () => {
  it("puts no map id or segment id in a reason", () => {
    const refusal = pathOne(area("studio"), { ...vacuum, mapping: withMapping([["studio", ["MapZ_none_1"]]]) });
    expect(JSON.stringify(refusal)).not.toMatch(/Map[A-Z]_/);
  });
});
