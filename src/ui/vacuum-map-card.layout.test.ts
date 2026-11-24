// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  changeModel,
  fixtureHass,
  injected,
  mount,
  newCard,
  nextHass,
  pictures,
  settle,
  shadowOf,
  useTestCard,
  withFirstFloorPlan,
} from "../../test/helpers/card";
import { expectNoConsoleOutput } from "../../test/helpers/no-console";
import { roombaPlusStates } from "../../test/helpers/roomba-plus-states";
import { stylesText } from "../../test/helpers/shadow";
import { createAdapters } from "../adapters/create-adapters";
import type { FloorModel } from "../app/floor-model/floor-model";
import type { PictureState } from "../domain/robot/stored-map";
import { VacuumMapCard } from "./vacuum-map-card";

useTestCard();
expectNoConsoleOutput();

/** The plan pictures' URL: an invented one that names its entity, so a test can tell them apart. */
function fakePictures(token = "t1"): void {
  injected.current.createAdapters = (getHass) => ({
    ...createAdapters(getHass),
    pictureUrl: (entityId) => `https://pictures.example.invalid/${entityId}?token=${token}`,
  });
}

function headings(card: VacuumMapCard): string[] {
  return [...shadowOf(card).querySelectorAll("section > h2")].map((h) => h.textContent?.trim() ?? "");
}

async function images(card: VacuumMapCard): Promise<HTMLImageElement[]> {
  const elements = pictures(card);
  await Promise.all(elements.map((p) => p.updateComplete));
  return elements.flatMap((p) => [...shadowOf(p).querySelectorAll("img")]);
}

function captions(card: VacuumMapCard): string[] {
  return [...shadowOf(card).querySelectorAll("figcaption")].map(
    (c) => c.textContent?.replace(/\s+/g, " ").trim() ?? "",
  );
}

/** Every text node, `title` and `aria-*` value of the card and of its plan pictures. */
function readableText(card: VacuumMapCard): string {
  const roots: ParentNode[] = [shadowOf(card), ...pictures(card).map((p) => shadowOf(p))];
  return roots
    .flatMap((root) => [
      root.textContent ?? "",
      ...[...root.querySelectorAll("*")].flatMap((element) =>
        [...element.attributes].filter((a) => a.name === "title" || a.name.startsWith("aria-")).map((a) => a.value),
      ),
    ])
    .join(" ");
}

describe("VacuumMapCard layout", () => {
  it("renders each floor as a section headed by its name, in model order, then the « no floor » group", async () => {
    const card = await mount(fixtureHass());
    expect(headings(card)).toStrictEqual(["Ground floor", "Upper floor", "Plans without a floor"]);
  });

  it("shows no « no floor » group when it is empty", async () => {
    changeModel((model) => ({ ...model, noFloor: [] }));
    const card = await mount(fixtureHass());
    expect(headings(card)).toStrictEqual(["Ground floor", "Upper floor"]);
  });

  it("starts with the « no floor » group, with no empty grid above it, when no plan is on a floor", async () => {
    changeModel((model) => ({ ...model, floors: [] }));
    const card = await mount(fixtureHass());
    expect(headings(card)).toStrictEqual(["Plans without a floor"]);
    expect(shadowOf(card).querySelector(".content > .plans")).toBeNull();
  });

  it("shows each plan's picture from Adapters.pictureUrl, with an alt naming its floor, or its map and robot", async () => {
    fakePictures();
    const card = await mount(fixtureHass());
    const shown = (await images(card)).map((img) => [img.getAttribute("src"), img.alt]);
    expect(shown.slice(0, 2)).toStrictEqual([
      ["https://pictures.example.invalid/image.robot_one_floor_plan_mapa_q1w2e3?token=t1", "Floor plan, Ground floor"],
      ["https://pictures.example.invalid/image.robot_one_floor_plan_mapb_z9x8c7?token=t1", "Floor plan, Upper floor"],
    ]);
    expect(shown.slice(2).map(([, alt]) => alt)).toStrictEqual([
      "Floor plan, Current map, Robot One",
      "Floor plan, Upper level, Robot Two",
      "Floor plan, Current map, Robot Two",
    ]);
  });

  it("labels each plan with its map name and its robot's name, without repeating its floor's name", async () => {
    const card = await mount(fixtureHass());
    expect(captions(card)).toStrictEqual([
      "Robot One",
      "Robot One",
      "Current map · Robot One",
      "Upper level · Robot Two",
      "Current map · Robot Two",
    ]);
  });

  it("labels a map without a safe name « Map n » by its place in the robot's stored maps, never its id", async () => {
    withFirstFloorPlan({ mapName: undefined });
    const card = await mount(fixtureHass());
    expect(captions(card)[0]).toBe("Map 1 · Robot One");
    expect(readableText(card)).not.toMatch(/MapA|q1W2e3/i);
  });

  it("hides the caption separator from screen readers", async () => {
    const card = await mount(fixtureHass());
    const separators = [...shadowOf(card).querySelectorAll("figcaption span")];
    expect(separators.map((s) => [s.textContent, s.getAttribute("aria-hidden")])).toContainEqual(["·", "true"]);
  });

  it("gives a new src on the next render when the image state changes", async () => {
    const hass = fixtureHass();
    const card = await mount(hass);
    const [before] = await images(card);
    expect(before?.getAttribute("src")).toContain("token=0000");
    const states = roombaPlusStates();
    const plan = "image.robot_one_floor_plan_mapa_q1w2e3";
    const image = Object(states[plan]);
    states[plan] = { ...image, attributes: { ...image.attributes, access_token: "rotated" } };
    card.hass = nextHass(hass, { states });
    await settle(card);
    const [after] = await images(card);
    expect(after?.getAttribute("src")).toContain("token=rotated");
  });

  it("never shows a picture URL as text, in a title or an aria attribute", async () => {
    const card = await mount(fixtureHass());
    expect((await images(card)).length).toBeGreaterThan(0);
    for (const picture of pictures(card)) shadowOf(picture).querySelector("img")?.dispatchEvent(new Event("error"));
    await Promise.all(pictures(card).map((p) => p.updateComplete));
    const text = readableText(card);
    expect(text).not.toMatch(/token|image_proxy|example\.invalid/);
    expect(text).toContain("The floor plan picture could not be loaded.");
  });

  it.each<[PictureState, string]>([
    ["unavailable", "This floor plan is unavailable."],
    ["unknown", "This floor plan has no picture yet."],
  ])("shows a readable message in place of a %s picture", async (pictureState, message) => {
    fakePictures();
    withFirstFloorPlan({ pictureState });
    const card = await mount(fixtureHass());
    const ground = shadowOf(card).querySelector("section");
    expect(ground?.querySelector("vmc-plan-picture")).toBeNull();
    expect(ground?.querySelector(".plan-message")?.textContent?.trim()).toBe(message);
  });

  it("shows a readable message when the picture has no URL", async () => {
    injected.current.createAdapters = (getHass) => ({ ...createAdapters(getHass), pictureUrl: () => undefined });
    const card = await mount(fixtureHass());
    const messages = [...shadowOf(card).querySelectorAll(".plan-message")].map((m) => m.textContent?.trim());
    expect(messages).toHaveLength(5);
    expect(new Set(messages)).toStrictEqual(new Set(["This floor plan picture cannot be shown right now."]));
  });

  it("speaks French in headings, labels and alt texts", async () => {
    const hass = fixtureHass();
    hass.language = "fr";
    hass.locale = { language: "fr" };
    const card = await mount(hass);
    expect(headings(card).at(-1)).toBe("Plans sans étage");
    expect(captions(card).at(-1)).toBe("Plan actuel · Robot Two");
    expect((await images(card)).map((img) => img.alt).slice(0, 1)).toStrictEqual(["Plan : Ground floor"]);
  });
});

describe("VacuumMapCard sizing", () => {
  it("returns new grid options each call: full width, height from content, at least half the section", () => {
    const card = newCard();
    const options = card.getGridOptions();
    expect(options).toStrictEqual({ columns: 12, rows: "auto", min_columns: 6 });
    expect(card.getGridOptions()).not.toBe(options);
  });

  /** The plans that show a room list or a note under their picture. */
  function withExtras(card: VacuumMapCard): number {
    return [...shadowOf(card).querySelectorAll(".plan")].filter((plan) =>
      plan.querySelector('.room-list, [role="note"]'),
    ).length;
  }

  it("estimates its size synchronously from the number of plans and their lists or notes", async () => {
    const card = await mount(fixtureHass());
    expect(withExtras(card)).toBeGreaterThan(0);
    expect(card.getCardSize()).toBe(5 * 7 + 2 * withExtras(card) + 1);
    changeModel((model) => ({ ...model, floors: model.floors.slice(0, 1), noFloor: [] }));
    const one = await mount(fixtureHass());
    expect(one.getCardSize()).toBe(7 + 2 * withExtras(one));
  });

  it("counts the robots' notes, with or without plans", async () => {
    const issues = (model: FloorModel): FloorModel => ({
      ...model,
      robots: model.robots.map((robot) => ({ ...robot, roomsMapIssue: { kind: "no_outlines" } })),
    });
    changeModel((model) => issues({ ...model, floors: model.floors.slice(0, 1), noFloor: [] }));
    const one = await mount(fixtureHass());
    expect(one.getCardSize()).toBe(7 + 2 * withExtras(one) + 2);
    changeModel((model) => issues({ ...model, floors: [], noFloor: [] }));
    expect((await mount(fixtureHass())).getCardSize()).toBe(1 + 2);
  });

  it("estimates a small size before the plans are read, and when there is none", async () => {
    expect(newCard().getCardSize()).toBe(1);
    changeModel((model) => ({ ...model, floors: [], noFloor: [] }));
    expect((await mount(fixtureHass())).getCardSize()).toBe(1);
  });

  it.each([
    ["grid", true],
    ["panel", false],
    [undefined, false],
  ])("fills its cell only in a sections grid (layout %s)", async (layout, fills) => {
    const card = await mount(fixtureHass());
    card.layout = layout;
    await card.updateComplete;
    expect(card.matches('[layout="grid"]')).toBe(fills);
  });

  it("fills a grid cell and lays plans out by the card's own width, not the viewport's", () => {
    const rules = stylesText(VacuumMapCard);
    expect(rules).toMatch(/:host\(\[layout="grid"\]\)[^{]*\{[^}]*height:\s*100%/);
    expect(rules).toMatch(/container-type:\s*inline-size/);
    expect(rules).toMatch(
      /@container \(min-width: [^)]+\)\s*\{\s*\.plans\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit, minmax\(/,
    );
    expect(rules).not.toMatch(/@media/);
    expect(rules).toMatch(/:host\(\[layout="grid"\]\) \.content\s*\{[^}]*overflow:\s*auto/);
  });
});
