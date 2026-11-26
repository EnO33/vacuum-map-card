import { describe, expect, it } from "vitest";
import { NO_OPTIONS, OPTION_NAMES } from "../app/config/card-config";
import { configForm } from "./config-form";

describe("configForm", () => {
  it("has one field per option, in the options' order, with Home Assistant's selectors", () => {
    expect(configForm(() => "en").schema).toStrictEqual([
      { name: "title", selector: { text: {} } },
      { name: "robots", selector: { entity: { multiple: true, filter: { domain: "vacuum" } } } },
      { name: "floors", selector: { floor: { multiple: true } } },
    ]);
  });

  it("lists every option of the card", () => {
    expect([...OPTION_NAMES].sort()).toStrictEqual(Object.keys(NO_OPTIONS).sort());
  });

  it("accepts what the card accepts, Home Assistant's own keys included", () => {
    const { assertConfig } = configForm(() => "en");
    expect(() => assertConfig({ type: "custom:vacuum-map-card", grid_options: { columns: 12 } })).not.toThrow();
    expect(() =>
      assertConfig({ type: "custom:vacuum-map-card", title: "Robots", robots: ["vacuum.my_robot"], floors: [] }),
    ).not.toThrow();
  });

  it("refuses a YAML-only shape with the parser's message, which turns the visual editor off", () => {
    const { assertConfig } = configForm(() => "en");
    expect(() => assertConfig({ type: "custom:vacuum-map-card", floor: ["upper_floor"] })).toThrow(
      'Unknown option "floor". The options are title, robots and floors.',
    );
    expect(() => assertConfig({ type: "custom:vacuum-map-card", robots: ["light.kitchen"] })).toThrow(
      /Option "robots"/,
    );
  });

  it.each([
    ["en", ["Title", "Robots", "Floors"], "Leave empty to use every robot found."],
    ["fr", ["Titre", "Robots", "Étages"], "Laissez vide pour utiliser tous les robots trouvés."],
    ["fr-CA", ["Titre", "Robots", "Étages"], "Laissez vide pour utiliser tous les robots trouvés."],
    ["de", ["Title", "Robots", "Floors"], "Leave empty to use every robot found."],
    ["", ["Title", "Robots", "Floors"], "Leave empty to use every robot found."],
    [undefined, ["Title", "Robots", "Floors"], "Leave empty to use every robot found."],
  ])("labels and explains the fields in the language %j", (lang, labels, robotsHelper) => {
    const { computeLabel, computeHelper } = configForm(() => lang);
    expect(OPTION_NAMES.map((name) => computeLabel({ name }))).toStrictEqual(labels);
    expect(computeHelper({ name: "robots" })).toBe(robotsHelper);
  });

  it("reads the language on each call, so the labels follow a change while the editor is open", () => {
    let lang = "en";
    const { computeLabel } = configForm(() => lang);
    expect(computeLabel({ name: "floors" })).toBe("Floors");
    lang = "fr";
    expect(computeLabel({ name: "floors" })).toBe("Étages");
  });

  it("leaves a field it does not know to Home Assistant", () => {
    const { computeLabel, computeHelper } = configForm(() => "en");
    expect(computeLabel({ name: "grid_options" })).toBeUndefined();
    expect(computeHelper({ name: "toString" })).toBeUndefined();
  });
});
