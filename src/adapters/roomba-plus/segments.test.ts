import { describe, expect, it } from "vitest";
import registryList from "../../../test/fixtures/ha-core/entity_registry_list.json" with { type: "json" };
import { fixtureMaps } from "../../../test/helpers/stored-maps";
import { MAX_TEXT_LENGTH } from "../../domain/text/limits";
import { segmentLinks } from "./segments";

const ROBOT_ONE = [fixtureMaps.mapA.mapId, fixtureMaps.mapB.mapId];

/** Every `last_seen_segments` id of the fixture vacuum. */
const lastSeenIds = (
  registryList.find((e) => e.entity_id === "vacuum.robot_one")?.options.vacuum?.last_seen_segments ?? []
).map((s) => s.id);

describe("mapOfSegment", () => {
  const { mapOfSegment } = segmentLinks(ROBOT_ONE);

  it("finds the map of every fixture segment id, zid_ ids included", () => {
    expect(lastSeenIds.length).toBeGreaterThan(0);
    expect(lastSeenIds.map(mapOfSegment)).toStrictEqual(lastSeenIds.map((id) => id.slice(0, "MapA_q1W2e3".length)));
    expect(mapOfSegment("MapA_q1W2e3_zid_2")).toBe("MapA_q1W2e3");
  });

  it("tries the longest map id first", () => {
    expect(segmentLinks(["A", "A_1"]).mapOfSegment("A_1_2")).toBe("A_1");
    expect(segmentLinks(["A_1", "A"]).mapOfSegment("A_1_2")).toBe("A_1");
    expect(segmentLinks(["A", "A_1"]).mapOfSegment("A_2")).toBe("A");
  });

  it.each<[string, string]>([
    ["an empty rest", "A_"],
    ["the map id alone", "A"],
    ["another robot's map", `${fixtureMaps.mapC.mapId}_1`],
    ["a prefix without separator", "AB_1"],
  ])("gives undefined for %s", (_, segmentId) => {
    expect(segmentLinks(["A", ...ROBOT_ONE]).mapOfSegment(segmentId)).toBeUndefined();
  });
});

describe("segmentOf", () => {
  it("builds <map id>_<region id> for a map of this robot", () => {
    expect(segmentLinks(ROBOT_ONE).segmentOf("MapA_q1W2e3", "1")).toBe("MapA_q1W2e3_1");
  });

  it.each<[string, readonly string[], string, string]>([
    ["a map of another robot", ROBOT_ONE, fixtureMaps.mapC.mapId, "1"],
    ["an empty region id", ROBOT_ONE, "MapA_q1W2e3", ""],
    ["a result over the cap", ROBOT_ONE, "MapA_q1W2e3", "r".repeat(MAX_TEXT_LENGTH)],
    ["a result another map would claim", ["A", "A_1"], "A", "1_2"],
  ])("gives undefined for %s", (_, mapIds, mapId, regionId) => {
    expect(segmentLinks(mapIds).segmentOf(mapId, regionId)).toBeUndefined();
  });

  it("accepts a result exactly at the cap", () => {
    const regionId = "r".repeat(MAX_TEXT_LENGTH - "MapA_q1W2e3_".length);
    expect(segmentLinks(ROBOT_ONE).segmentOf("MapA_q1W2e3", regionId)).toHaveLength(MAX_TEXT_LENGTH);
  });
});
