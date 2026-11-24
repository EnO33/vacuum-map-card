import { describe, expect, it } from "vitest";
import { MAX_TEXT_LENGTH } from "../../domain/text/limits";
import { safeMapName } from "./map-name";

const MAP_ID = "MapA_q1W2e3";
const VACUUM_UNIQUE_ID = "roomba_plus_ROBOTBLID0001";

describe("safeMapName", () => {
  it.each<[string]>([["Ground floor"], ["Upper level"], ["Ñandú wing"]])("keeps %s", (name) => {
    expect(safeMapName(name, MAP_ID, VACUUM_UNIQUE_ID)).toBe(name);
  });

  it.each<[string, unknown]>([
    ["not a string", 3],
    ["missing", undefined],
    ["empty", ""],
    ["over the cap", "n".repeat(MAX_TEXT_LENGTH + 1)],
    ["equal to the map id", MAP_ID],
    ["equal to the map id in another case", "mapa_Q1w2E3"],
    ["a Prime-like name with the robot identifier", "ROBOTBLID0001-1767225600"],
    ["the robot identifier in lower case", "robotblid0001 map"],
  ])("hides a name %s", (_, name) => {
    expect(safeMapName(name, MAP_ID, VACUUM_UNIQUE_ID)).toBeUndefined();
  });

  it("uses the whole unique_id as the identifier when it lacks the integration prefix", () => {
    expect(safeMapName("Map of SERIAL42", MAP_ID, "SERIAL42")).toBeUndefined();
    expect(safeMapName("Ground floor", MAP_ID, "SERIAL42")).toBe("Ground floor");
  });

  it("hides every name when the robot identifier is empty", () => {
    expect(safeMapName("Ground floor", MAP_ID, "roomba_plus_")).toBeUndefined();
  });
});
