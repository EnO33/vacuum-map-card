import { describe, expect, it } from "vitest";
import docked from "../../../test/fixtures/ha-core/hass_states_vacuum_docked.json" with { type: "json" };
import cleaning from "../../../test/fixtures/ha-core/synthetic/hass_state_vacuum_cleaning.json" with { type: "json" };
import unavailable from "../../../test/fixtures/ha-core/synthetic/hass_state_vacuum_unavailable.json" with {
  type: "json",
};
import { robotAvailability } from "./availability";

describe("robotAvailability", () => {
  it.each([
    ["docked", docked["vacuum.robot_one"].state],
    ["cleaning", cleaning.state],
  ])("is startable when %s (fixture)", (_, state) => {
    expect(robotAvailability({ state })).toEqual({ kind: "startable", state });
  });

  it.each(["idle", "paused", "returning", "error", "unknown"])("is startable when %s", (state) => {
    expect(robotAvailability({ state })).toEqual({ kind: "startable", state });
  });

  it("is not startable when unavailable (fixture)", () => {
    expect(robotAvailability({ state: unavailable.state })).toEqual({ kind: "not_startable", reason: "unavailable" });
  });

  it("is not startable without a state (missing or disabled)", () => {
    expect(robotAvailability(undefined)).toEqual({ kind: "not_startable", reason: "no_state" });
  });
});
