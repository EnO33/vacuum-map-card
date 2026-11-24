import { beforeEach, describe, expect, it } from "vitest";
import { FakeFrontendHass } from "../../../test/fakes/frontend-hass";
import unavailable from "../../../test/fixtures/ha-core/synthetic/hass_state_vacuum_unavailable.json" with {
  type: "json",
};
import { MAX_TEXT_LENGTH } from "../../domain/text/limits";
import { vacuumReader } from "./vacuum-state";

let hass: FakeFrontendHass;
let vacuum: ReturnType<typeof vacuumReader>;

function withState(state: unknown): void {
  hass.states = { "vacuum.robot_one": state };
}

beforeEach(() => {
  hass = new FakeFrontendHass();
  vacuum = vacuumReader(() => hass);
});

describe("vacuumReader", () => {
  it("reads the docked fixture robot", () => {
    expect(vacuum("vacuum.robot_one")).toStrictEqual({ state: "docked", supportedFeatures: 29500 });
  });

  it("reads the unavailable fixture robot", () => {
    withState(unavailable);
    expect(vacuum("vacuum.robot_one")).toStrictEqual({ state: "unavailable", supportedFeatures: 29500 });
  });

  it("returns the same object for the same state object, and a new one for a new state", () => {
    const first = vacuum("vacuum.robot_one");
    expect(vacuum("vacuum.robot_one")).toBe(first);
    hass.states = structuredClone(hass.states);
    expect(vacuum("vacuum.robot_one")).not.toBe(first);
  });

  it("reads hass again on each call", () => {
    expect(vacuum("vacuum.robot_one")?.state).toBe("docked");
    const other = new FakeFrontendHass();
    other.states = { "vacuum.robot_one": { state: "cleaning", attributes: { supported_features: 1 } } };
    hass = other;
    expect(vacuum("vacuum.robot_one")).toStrictEqual({ state: "cleaning", supportedFeatures: 1 });
  });

  it.each<[string, unknown]>([
    ["missing", undefined],
    ["null", null],
    ["a string", "states"],
  ])("is undefined when hass.states is %s", (_, value) => {
    hass.states = value;
    expect(vacuum("vacuum.robot_one")).toBeUndefined();
  });

  it.each<[string, unknown]>([
    ["missing", undefined],
    ["not an object", "docked"],
    ["without a string state", { state: 1, attributes: {} }],
    ["with an over-cap state", { state: "x".repeat(MAX_TEXT_LENGTH + 1), attributes: {} }],
  ])("is undefined for a state object %s", (_, state) => {
    withState(state);
    expect(vacuum("vacuum.robot_one")).toBeUndefined();
  });

  it("reads only own keys of hass.states", () => {
    hass.states = Object.create({ "vacuum.robot_one": { state: "docked", attributes: {} } });
    expect(vacuum("vacuum.robot_one")).toBeUndefined();
    expect(vacuum("__proto__")).toBeUndefined();
  });

  it.each<[string, unknown]>([
    ["missing", undefined],
    ["a string", "29500"],
    ["negative", -1],
    ["fractional", 1.5],
    ["unsafe", Number.MAX_SAFE_INTEGER + 1],
    ["not a number", Number.NaN],
  ])("reads supported_features %s as 0", (_, features) => {
    withState({ state: "docked", attributes: { supported_features: features } });
    expect(vacuum("vacuum.robot_one")).toStrictEqual({ state: "docked", supportedFeatures: 0 });
  });

  it("reads supported_features as 0 when attributes is not an object", () => {
    withState({ state: "docked", attributes: null });
    expect(vacuum("vacuum.robot_one")).toStrictEqual({ state: "docked", supportedFeatures: 0 });
  });
});
