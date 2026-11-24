import { beforeEach, describe, expect, it } from "vitest";
import { FakeFrontendHass } from "../../../test/fakes/frontend-hass";
import imagePlan from "../../../test/fixtures/ha-core/hass_state_image_floor_plan.json" with { type: "json" };
import { roombaPlusStates } from "../../../test/helpers/roomba-plus-states";
import { createDisplay } from "./display";

const OVER_CAP = "x".repeat(256);
const AT_CAP = "x".repeat(255);

let hass: FakeFrontendHass;

beforeEach(() => {
  hass = new FakeFrontendHass();
});

describe("language", () => {
  const language = () => createDisplay(() => hass).language();

  it("reads hass.locale.language first", () => {
    hass.locale = { language: "fr" };
    hass.language = "en";
    expect(language()).toBe("fr");
  });

  it("keeps a code at the cap", () => {
    hass.locale = { language: AT_CAP };
    expect(language()).toBe(AT_CAP);
  });

  it.each<[string, unknown]>([
    ["a null locale", null],
    ["a missing locale", undefined],
    ["a string locale", "fr"],
    ["a locale without language", {}],
    ["an empty language", { language: "" }],
    ["a language over the cap", { language: OVER_CAP }],
    ["a non-string language", { language: 7 }],
    ["an inherited language", Object.create({ language: "fr" })],
    [
      "a language getter",
      {
        get language() {
          return "fr";
        },
      },
    ],
  ])("falls back to hass.language for %s", (_, locale) => {
    hass.locale = locale;
    hass.language = "de";
    expect(language()).toBe("de");
  });

  it.each<[string, unknown]>([
    ["null", null],
    ["missing", undefined],
    ["empty", ""],
    ["over the cap", OVER_CAP],
    ["not a string", ["fr"]],
  ])("is undefined when locale is unusable and hass.language is %s", (_, value) => {
    hass.locale = null;
    hass.language = value;
    expect(language()).toBeUndefined();
  });

  it.each([null, undefined])("is undefined for a %s hass", (value) => {
    expect(createDisplay(() => value).language()).toBeUndefined();
  });

  it("reads hass again on each call", () => {
    const display = createDisplay(() => hass);
    hass.locale = { language: "en" };
    expect(display.language()).toBe("en");
    const other = new FakeFrontendHass();
    other.locale = { language: "fr" };
    hass = other;
    expect(display.language()).toBe("fr");
  });
});

describe("robotName", () => {
  const robotName = (entityId: string) => createDisplay(() => hass).robotName(entityId);
  const withAttributes = (attributes: unknown) => {
    hass.states = { "vacuum.robot_one": { state: "docked", attributes } };
  };

  it("reads the friendly_name of the captured state", () => {
    expect(robotName("vacuum.robot_one")).toBe("Robot One");
    expect(robotName("vacuum.robot_two")).toBe("Robot Two");
  });

  it("keeps a name at the cap", () => {
    withAttributes({ friendly_name: AT_CAP });
    expect(robotName("vacuum.robot_one")).toBe(AT_CAP);
  });

  it.each<[string, unknown]>([
    ["no friendly_name", {}],
    ["an empty name", { friendly_name: "" }],
    ["a name over the cap", { friendly_name: OVER_CAP }],
    ["a non-string name", { friendly_name: { text: "Robot One" } }],
    ["an inherited name", Object.create({ friendly_name: "Robot One" })],
    [
      "a name getter",
      {
        get friendly_name() {
          return "Robot One";
        },
      },
    ],
    ["null attributes", null],
    ["missing attributes", undefined],
    ["string attributes", "Robot One"],
  ])("is undefined for %s", (_, attributes) => {
    withAttributes(attributes);
    expect(robotName("vacuum.robot_one")).toBeUndefined();
  });

  it.each<[string, unknown]>([
    ["null states", null],
    ["missing states", undefined],
    ["a missing entity", {}],
    ["a null state object", { "vacuum.robot_one": null }],
    ["an inherited entity", Object.create({ "vacuum.robot_one": { attributes: { friendly_name: "Robot One" } } })],
  ])("is undefined for %s", (_, states) => {
    hass.states = states;
    expect(robotName("vacuum.robot_one")).toBeUndefined();
  });

  it.each([null, undefined])("is undefined for a %s hass", (value) => {
    expect(createDisplay(() => value).robotName("vacuum.robot_one")).toBeUndefined();
  });

  it("returns equal strings for an unchanged state object and follows a new one", () => {
    const display = createDisplay(() => hass);
    const first = display.robotName("vacuum.robot_one");
    expect(display.robotName("vacuum.robot_one")).toBe(first);
    hass.states = { "vacuum.robot_one": { state: "docked", attributes: { friendly_name: "Renamed" } } };
    expect(display.robotName("vacuum.robot_one")).toBe("Renamed");
  });
});

describe("what crosses the port", () => {
  it("carries no token, picture URL or unique id for the fixtures", () => {
    const states = { ...roombaPlusStates(), [imagePlan.entity_id]: structuredClone(imagePlan) };
    hass.states = states;
    hass.locale = { language: "en", number_format: "language" };
    const display = createDisplay(() => hass);
    const ids = Object.keys(states);
    const crossed = JSON.stringify({ language: display.language(), names: ids.map((id) => display.robotName(id)) });
    expect(crossed).toContain("Robot One");
    for (const secret of ["access_token", "entity_picture", "unique_id", "token=", imagePlan.attributes.access_token]) {
      expect(crossed).not.toContain(secret);
    }
  });
});
