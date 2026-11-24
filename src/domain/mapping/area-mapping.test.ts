import { describe, expect, it } from "vitest";
import {
  areaMappingOf,
  type EntityRegistryFixture,
  knownAreaIds,
  mappingFixtures,
} from "../../../test/helpers/area-mapping";
import { MAX_TEXT_LENGTH } from "../text/limits";
import { unsupported } from "../unsupported";
import {
  type AreaMapping,
  type AreaMappingResult,
  areaOfSegment,
  areasOfMap,
  areasOnMapping,
  readAreaMapping,
  segmentsOfArea,
} from "./area-mapping";
import { MAX_AREA_MAPPING_KEYS, MAX_MAPPED_SEGMENTS, MAX_SEGMENTS_PER_AREA } from "./limits";

const areas = new Set(["a", "b", "c", "__proto__", "constructor", "hasOwnProperty"]);
const long = "x".repeat(MAX_TEXT_LENGTH + 1);

const read = (entries: [string, string[]][]) => readAreaMapping(new Map(entries), areas);

function expectMapping(result: AreaMappingResult): AreaMapping {
  if (result.kind !== "mapping") throw new Error(`expected a mapping, got ${JSON.stringify(result)}`);
  return result;
}

const mappingOf = (entries: [string, string[]][]) => expectMapping(read(entries));
const fixtureMapping = (fixture: EntityRegistryFixture) =>
  expectMapping(readAreaMapping(areaMappingOf(fixture), knownAreaIds));

describe("readAreaMapping on the fixtures", () => {
  it("gives the vacuum robot's areas and segments", () => {
    const mapping = fixtureMapping(mappingFixtures.vacuum);
    expect(areasOnMapping(mapping)).toEqual(["library", "workshop", "music_room", "studio"]);
    expect(segmentsOfArea(mapping, "library")).toEqual(["MapA_q1W2e3_1"]);
    expect(segmentsOfArea(mapping, "workshop")).toEqual(["MapA_q1W2e3_zid_2"]);
    expect(segmentsOfArea(mapping, "music_room")).toEqual(["MapB_z9X8c7_3"]);
    expect(segmentsOfArea(mapping, "studio")).toEqual(["MapB_z9X8c7_2"]);
    expect(areaOfSegment(mapping, "MapB_z9X8c7_2")).toEqual({ kind: "one", areaId: "studio" });
  });

  it.each([
    ["mop robot", mappingFixtures.mop],
    ["no-mapping", mappingFixtures.noMapping],
  ])("gives absent for the %s fixture", (_, fixture) => {
    expect(readAreaMapping(areaMappingOf(fixture), knownAreaIds)).toEqual({ kind: "absent" });
  });

  it("ignores a key that is not a known area", () => {
    const mapping = fixtureMapping(mappingFixtures.deletedArea);
    expect(areasOnMapping(mapping)).toEqual(["library", "workshop", "music_room", "studio"]);
    expect(segmentsOfArea(mapping, "deleted_room")).toEqual([]);
    expect(areaOfSegment(mapping, "MapB_z9X8c7_1")).toEqual({ kind: "none" });
  });
});

describe("readAreaMapping rules", () => {
  it("gives a mapping with no areas, not absent, for an empty mapping", () => {
    expect(areasOnMapping(mappingOf([]))).toEqual([]);
  });

  it("ignores an empty list, so its area is never offered", () => {
    expect(
      areasOnMapping(
        mappingOf([
          ["a", []],
          ["b", ["s1"]],
        ]),
      ),
    ).toEqual(["b"]);
  });

  it("counts an id repeated in one list once, keeping the stored order", () => {
    const mapping = mappingOf([["a", ["s2", "s1", "s2"]]]);
    expect(segmentsOfArea(mapping, "a")).toEqual(["s2", "s1"]);
    expect(areaOfSegment(mapping, "s2")).toEqual({ kind: "one", areaId: "a" });
  });

  it("gives no single area to a segment listed under two areas", () => {
    const mapping = mappingOf([
      ["a", ["s1", "s2"]],
      ["b", ["s1"]],
    ]);
    expect(areaOfSegment(mapping, "s1")).toEqual({ kind: "several" });
    expect(areaOfSegment(mapping, "s2")).toEqual({ kind: "one", areaId: "a" });
    expect(areaOfSegment(mapping, "s3")).toEqual({ kind: "none" });
  });

  it("does not let an unknown key make a segment ambiguous", () => {
    const mapping = mappingOf([
      ["a", ["s1"]],
      ["gone", ["s1"]],
    ]);
    expect(areaOfSegment(mapping, "s1")).toEqual({ kind: "one", areaId: "a" });
  });

  it("treats object property names as ordinary area and segment ids", () => {
    const names = ["__proto__", "constructor", "hasOwnProperty"];
    const mapping = mappingOf(names.map((name) => [name, [name]]));
    expect(areasOnMapping(mapping)).toEqual(names);
    for (const name of names) {
      expect(segmentsOfArea(mapping, name)).toEqual([name]);
      expect(areaOfSegment(mapping, name)).toEqual({ kind: "one", areaId: name });
    }
    expect(areaOfSegment(mapping, "toString")).toEqual({ kind: "none" });
    expect(segmentsOfArea(mapping, "valueOf")).toEqual([]);
  });
});

describe("readAreaMapping caps", () => {
  const ids = (count: number, prefix = "s") => Array.from({ length: count }, (_, i) => `${prefix}${i}`);

  it("accepts the most keys and refuses one more", () => {
    const keys = ids(MAX_AREA_MAPPING_KEYS + 1, "k");
    expect(read(keys.slice(1).map((k) => [k, []])).kind).toBe("mapping");
    expect(read(keys.map((k) => [k, []]))).toEqual(unsupported("too_many_keys"));
  });

  it("accepts the most ids under one key and refuses one more", () => {
    expect(read([["a", ids(MAX_SEGMENTS_PER_AREA)]]).kind).toBe("mapping");
    expect(read([["a", ids(MAX_SEGMENTS_PER_AREA + 1)]])).toEqual(unsupported("too_many_segments_in_area"));
  });

  it("accepts the most ids in total and refuses one more, even under keys that are not areas", () => {
    const keys = Math.ceil(MAX_MAPPED_SEGMENTS / MAX_SEGMENTS_PER_AREA);
    const full = ids(keys, "k").map((k): [string, string[]] => [k, ids(MAX_SEGMENTS_PER_AREA, `${k}_`)]);
    expect(read(full).kind).toBe("mapping");
    expect(read([...full, ["a", ["one_more"]]])).toEqual(unsupported("too_many_segments"));
  });

  it.each([
    ["a key", [[long, ["s1"]]]],
    ["a segment id", [["a", ["s1", long]]]],
  ] satisfies [string, [string, string[]][]][])("refuses %s over the cap", (_, entries) => {
    expect(read(entries)).toEqual(unsupported("text_too_long"));
  });
});

describe("areasOfMap", () => {
  it("gives the kept areas with a segment on the map, in stored order", () => {
    const mapping = fixtureMapping(mappingFixtures.vacuum);
    const mapIds = ["MapA_q1W2e3", "MapB_z9X8c7"];
    const mapOfSegment = (segmentId: string) => mapIds.find((mapId) => segmentId.startsWith(`${mapId}_`));
    expect(areasOfMap(mapping, "MapA_q1W2e3", mapOfSegment)).toEqual(["library", "workshop"]);
    expect(areasOfMap(mapping, "MapB_z9X8c7", mapOfSegment)).toEqual(["music_room", "studio"]);
    expect(areasOfMap(mapping, "MapZ_none", mapOfSegment)).toEqual([]);
  });
});
