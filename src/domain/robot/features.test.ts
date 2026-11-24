import { describe, expect, it } from "vitest";
import vacuumStates from "../../../test/fixtures/ha-core/hass_states_vacuum_docked.json" with { type: "json" };
import { supportsCleanArea } from "./features";

describe("supportsCleanArea", () => {
  it("reads CLEAN_AREA from the fixtures' supported_features", () => {
    expect(supportsCleanArea(vacuumStates["vacuum.robot_one"].attributes.supported_features)).toBe(true);
    expect(supportsCleanArea(vacuumStates["vacuum.robot_two"].attributes.supported_features)).toBe(false);
  });

  it.each([
    [16384, true],
    [16383, false],
    [32768, false],
    [0, false],
  ])("gives %i %s", (features, expected) => {
    expect(supportsCleanArea(features)).toBe(expected);
  });
});
