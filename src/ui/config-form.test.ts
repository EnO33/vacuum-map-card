import { describe, expect, it } from "vitest";
import { NO_OPTIONS, OPTION_NAMES } from "../app/config/card-config";
import { configForm } from "./config-form";

describe("configForm", () => {
  it("has one field per option, in the options' order, with Home Assistant's selectors", () => {
    expect(configForm(["roomba_plus"], () => "en").schema).toStrictEqual([
      { name: "title", selector: { text: {} } },
      {
        name: "robots",
        selector: { entity: { multiple: true, filter: [{ domain: "vacuum", integration: "roomba_plus" }] } },
      },
      { name: "floors", selector: { floor: { multiple: true } } },
    ]);
  });

  it("offers only the vacuums of the supported integrations, one filter each", () => {
    const [, robots] = configForm(["one", "two"], () => "en").schema;
    expect(robots?.selector).toStrictEqual({
      entity: {
        multiple: true,
        filter: [
          { domain: "vacuum", integration: "one" },
          { domain: "vacuum", integration: "two" },
        ],
      },
    });
  });

  it("lists every option of the card", () => {
    expect([...OPTION_NAMES].sort()).toStrictEqual(Object.keys(NO_OPTIONS).sort());
  });

  it("accepts what the card accepts, Home Assistant's own keys included", () => {
    const { assertConfig } = configForm(["roomba_plus"], () => "en");
    expect(() => assertConfig({ type: "custom:vacuum-map-card", grid_options: { columns: 12 } })).not.toThrow();
    expect(() =>
      assertConfig({ type: "custom:vacuum-map-card", title: "Robots", robots: ["vacuum.my_robot"], floors: [] }),
    ).not.toThrow();
  });

  it("refuses a YAML-only shape with the parser's message, which turns the visual editor off", () => {
    const { assertConfig } = configForm(["roomba_plus"], () => "en");
    expect(() => assertConfig({ type: "custom:vacuum-map-card", floor: ["upper_floor"] })).toThrow(
      'Unknown option "floor". The options are title, robots and floors.',
    );
    expect(() => assertConfig({ type: "custom:vacuum-map-card", robots: ["light.kitchen"] })).toThrow(
      /Option "robots"/,
    );
  });

  const ENGLISH = {
    labels: ["Title", "Robots", "Floors"],
    helpers: [
      "Shown as the card's header. Leave empty for no header.",
      "Only these robots and their plans are shown. Leave empty to use every supported robot.",
      "Only these floors are shown, in Home Assistant's order. Leave empty to show every floor and the plans not assigned to one.",
    ],
  };
  const FRENCH = {
    labels: ["Titre", "Robots", "Étages"],
    helpers: [
      "Affiché en en-tête de la carte. Laissez vide pour ne pas afficher d'en-tête.",
      "Seuls ces robots et leurs plans sont affichés. Laissez vide pour utiliser tous les robots compatibles.",
      "Seuls ces étages sont affichés, dans l'ordre de Home Assistant. Laissez vide pour afficher tous les étages et les plans sans étage.",
    ],
  };

  it.each([
    ["en", ENGLISH],
    ["fr", FRENCH],
    ["fr-CA", FRENCH],
    ["de", ENGLISH],
    ["", ENGLISH],
    [undefined, ENGLISH],
  ])("labels and explains the fields in the language %j", (lang, { labels, helpers }) => {
    const { computeLabel, computeHelper } = configForm(["roomba_plus"], () => lang);
    expect(OPTION_NAMES.map((name) => computeLabel({ name }))).toStrictEqual(labels);
    expect(OPTION_NAMES.map((name) => computeHelper({ name }))).toStrictEqual(helpers);
  });

  it("reads the language on each call, so the labels follow a change while the editor is open", () => {
    let lang = "en";
    const { computeLabel } = configForm(["roomba_plus"], () => lang);
    expect(computeLabel({ name: "floors" })).toBe("Floors");
    lang = "fr";
    expect(computeLabel({ name: "floors" })).toBe("Étages");
  });

  it("leaves a field it does not know to Home Assistant", () => {
    const { computeLabel, computeHelper } = configForm(["roomba_plus"], () => "en");
    expect(computeLabel({ name: "grid_options" })).toBeUndefined();
    expect(computeHelper({ name: "toString" })).toBeUndefined();
  });
});
