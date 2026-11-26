// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import {
  bodyText,
  fixtureHass,
  mount,
  newCard,
  nextHass,
  settle,
  shadowOf,
  statusText,
  useTestCard,
} from "../../test/helpers/card";
import { expectNoConsoleOutput } from "../../test/helpers/no-console";
import { chooseFirstRobot, selectFirstRoom, usePickerElements } from "../../test/helpers/picker";
import { VacuumMapCard } from "./vacuum-map-card";

useTestCard();
expectNoConsoleOutput();

usePickerElements();

function header(card: VacuumMapCard): Element | null {
  return shadowOf(card).querySelector("ha-card > .card-header");
}

function headings(card: VacuumMapCard): string[] {
  return [...shadowOf(card).querySelectorAll("section > h2")].map((h) => h.textContent?.trim() ?? "");
}

function captions(card: VacuumMapCard): string[] {
  return [...shadowOf(card).querySelectorAll("figcaption")].map(
    (c) => c.textContent?.replace(/\s+/g, " ").trim() ?? "",
  );
}

describe("VacuumMapCard options", () => {
  it("offers an empty configuration as the card picker's stub", () => {
    expect(VacuumMapCard.getStubConfig()).toStrictEqual({});
  });

  it("keeps the parsed options", () => {
    expect(newCard({ title: "Robots", floors: ["upper_floor"] }).config).toStrictEqual({
      title: "Robots",
      robots: undefined,
      floors: ["upper_floor"],
    });
  });

  it("throws the parser's error for a wrong configuration, for Home Assistant to show", () => {
    const card = newCard();
    expect(() => card.setConfig({ type: "custom:vacuum-map-card", floor: ["upper_floor"] })).toThrow(
      'Unknown option "floor". The options are title, robots and floors.',
    );
  });

  it("has no header without a title, and no empty space for one", async () => {
    const card = await mount(fixtureHass());
    expect(header(card)).toBeNull();
    expect(shadowOf(card).querySelector("ha-card > :first-child")?.classList.contains("content")).toBe(true);
  });

  it("shows the title as the card's header, as text", async () => {
    const card = await mount(fixtureHass(), { title: "<b>Robots</b>" });
    expect(header(card)?.tagName).toBe("H1");
    expect(header(card)?.textContent).toBe("<b>Robots</b>");
    expect(header(card)?.querySelector("b")).toBeNull();
  });

  it("follows a new title, and its removal", async () => {
    const card = await mount(fixtureHass(), { title: "Robots" });
    card.setConfig({ type: "custom:vacuum-map-card", title: "Upstairs" });
    await card.updateComplete;
    expect(header(card)?.textContent).toBe("Upstairs");
    card.setConfig({ type: "custom:vacuum-map-card" });
    await card.updateComplete;
    expect(header(card)).toBeNull();
  });

  it("counts the header in its size only when it has a title", async () => {
    const untitled = await mount(fixtureHass());
    const titled = await mount(fixtureHass(), { title: "Robots" });
    expect(titled.getCardSize()).toBe(untitled.getCardSize() + 1);
    expect(newCard().getCardSize()).toBe(1);
    expect(newCard({ title: "Robots" }).getCardSize()).toBe(2);
  });

  it("shows only the plans of the listed robots", async () => {
    const all = captions(await mount(fixtureHass()));
    expect(all.filter((caption) => caption.endsWith("Robot One"))).toHaveLength(3);
    const card = await mount(fixtureHass(), { robots: ["vacuum.robot_two"] });
    expect(captions(card)).toHaveLength(3);
    expect(captions(card).every((caption) => caption.endsWith("Robot Two"))).toBe(true);
  });

  it("shows only the listed floors, in Home Assistant's order, without the « no floor » group", async () => {
    const card = await mount(fixtureHass(), { floors: ["upper_floor", "deleted_floor", "ground_floor"] });
    expect(headings(card)).toStrictEqual(["Ground floor", "Upper floor"]);
    const upper = await mount(fixtureHass(), { floors: ["upper_floor"] });
    expect(headings(upper)).toStrictEqual(["Upper floor"]);
  });

  it("says the floors option hides every plan when no listed floor has one", async () => {
    const card = await mount(fixtureHass(), { floors: ["deleted_floor"] });
    expect(bodyText(card)).toBe(
      "No floor plan on the listed floors. Check the card's floors option. " +
        "Plans not assigned to a floor are not shown while it is set.",
    );
  });

  it("says the robots option leaves no robot when no listed robot exists", async () => {
    const card = await mount(fixtureHass(), { robots: ["vacuum.robot_three"] });
    expect(bodyText(card)).toBe(
      "None of the listed robots was found Check the card's robots option: only vacuums from the Roomba+ " +
        "integration can be used.",
    );
  });

  it("says so in French too", async () => {
    const french = () => {
      const hass = fixtureHass();
      hass.language = "fr";
      hass.locale = { language: "fr" };
      return hass;
    };
    expect(bodyText(await mount(french(), { robots: ["vacuum.robot_three"] }))).toContain(
      "Aucun des robots listés n'a été trouvé",
    );
    expect(bodyText(await mount(french(), { floors: ["deleted_floor"] }))).toContain(
      "Aucun plan sur les étages listés.",
    );
  });

  it("applies new floors and robots without a new hass, and renders once per change only", async () => {
    const hass = fixtureHass();
    const card = await mount(hass);
    card.setConfig({ type: "custom:vacuum-map-card", floors: ["upper_floor"] });
    await card.updateComplete;
    expect(headings(card)).toStrictEqual(["Upper floor"]);
    card.setConfig({ type: "custom:vacuum-map-card", robots: ["vacuum.robot_two"] });
    await card.updateComplete;
    expect(captions(card).every((caption) => caption.endsWith("Robot Two"))).toBe(true);
    const renders = card.renders;
    card.hass = nextHass(hass, {});
    await settle(card);
    expect(card.renders).toBe(renders);
  });

  it("labels Home Assistant's visual editor in the page's language, which Home Assistant keeps on <html lang>", () => {
    const form = VacuumMapCard.getConfigForm();
    try {
      document.documentElement.lang = "fr";
      expect(form.computeLabel({ name: "floors" })).toBe("Étages");
    } finally {
      document.documentElement.lang = "";
    }
    expect(form.computeLabel({ name: "floors" })).toBe("Floors");
  });

  it("creates and defines no element for its editor: Home Assistant renders the form itself", () => {
    const created = vi.spyOn(document, "createElement");
    const defined = vi.spyOn(customElements, "define");
    try {
      const form = VacuumMapCard.getConfigForm();
      for (const { name } of form.schema) {
        form.computeLabel({ name });
        form.computeHelper({ name });
      }
      expect(created).not.toHaveBeenCalled();
      expect(defined).not.toHaveBeenCalled();
    } finally {
      created.mockRestore();
      defined.mockRestore();
    }
  });

  it("in the editor preview, follows each option picked in the form and still starts nothing", async () => {
    const hass = fixtureHass();
    const card = await mount(hass);
    card.preview = true;
    card.setConfig({ type: "custom:vacuum-map-card", floors: ["upper_floor"] });
    await card.updateComplete;
    expect(headings(card)).toStrictEqual(["Upper floor"]);
    card.setConfig({ type: "custom:vacuum-map-card", robots: ["vacuum.robot_two"] });
    await card.updateComplete;
    expect(captions(card).every((caption) => caption.endsWith("Robot Two"))).toBe(true);
    await selectFirstRoom(card);
    await chooseFirstRobot(card);
    await settle(card);
    expect(hass.calls).toEqual([]);
    expect(statusText(card)).toBe("Starting is turned off in the editor preview.");
  });
});
