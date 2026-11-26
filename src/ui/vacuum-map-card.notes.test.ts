// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { TestCard } from "../../test/helpers/card";
import {
  changeModel,
  firstPlan,
  fixtureHass,
  hassAs,
  mount,
  nextHass,
  shadowOf,
  collapsedText as text,
  useTestCard,
  withFirstFloorPlan,
} from "../../test/helpers/card";
import { expectNoConsoleOutput } from "../../test/helpers/no-console";
import { stylesText } from "../../test/helpers/shadow";
import type { Plan, RoomsMapIssue } from "../app/floor-model/floor-model";
import type { ItemRef } from "../app/robots-for-item/robots-for-item";
import { ROOM_SELECTED_EVENT } from "./plan-picture";
import { VacuumMapCard } from "./vacuum-map-card";

useTestCard();
expectNoConsoleOutput();

function mountAs(isAdmin: boolean): Promise<TestCard> {
  return mount(hassAs(isAdmin));
}

/** The vacuums' states with every friendly name replaced by `name`. */
function renamed(states: unknown, name: string): Record<string, unknown> {
  if (typeof states !== "object" || states === null) throw new Error("no states");
  return Object.fromEntries(
    Object.entries(states).map(([id, state]) => [
      id,
      id.startsWith("vacuum.") && typeof state === "object" && state !== null && "attributes" in state
        ? { ...state, attributes: { ...Object(state.attributes), friendly_name: name } }
        : state,
    ]),
  );
}

const AREAS = [
  { areaId: "area_one", name: "Kitchen" },
  { areaId: "area_two", name: "<b>Hall</b>" },
];

describe("VacuumMapCard room lists", () => {
  it("lists a plan's areas as buttons named by area, in model order, in a list named after its floor", async () => {
    withFirstFloorPlan({ content: { kind: "areas", items: AREAS } });
    const card = await mount(fixtureHass());
    const list = firstPlan(card)?.querySelector("ul.room-list");
    expect(list?.getAttribute("aria-label")).toBe("Rooms, Ground floor");
    const buttons = [...(list?.querySelectorAll("li > button") ?? [])];
    expect(buttons.map(text)).toStrictEqual(["Kitchen", "<b>Hall</b>"]);
    expect(list?.querySelector("b")).toBeNull();
    expect(buttons.every((button) => button.getAttribute("type") === "button")).toBe(true);
  });

  it("fires the area's item when its button is clicked, inside the card only", async () => {
    withFirstFloorPlan({ imageEntityId: "image.listed_plan", content: { kind: "areas", items: AREAS } });
    const card = await mount(fixtureHass());
    const inside: ItemRef[] = [];
    let outside = 0;
    shadowOf(card).addEventListener(ROOM_SELECTED_EVENT, (event) => {
      if (event instanceof CustomEvent) inside.push(event.detail);
    });
    card.addEventListener(ROOM_SELECTED_EVENT, () => outside++);
    const button = firstPlan(card)?.querySelectorAll("ul.room-list button")[1];
    if (!(button instanceof HTMLElement)) throw new Error("no button");
    button.click();
    expect(inside).toStrictEqual([{ kind: "area", imageEntityId: "image.listed_plan", areaId: "area_two" }]);
    expect(outside).toBe(0);
  });

  it("says why a picture-only plan cannot start rooms, under its picture", async () => {
    withFirstFloorPlan({ content: { kind: "picture_only", reason: "no_clean_area" } });
    const card = await mount(fixtureHass());
    const note = firstPlan(card)?.querySelector('[role="note"]');
    expect(text(note)).toBe(
      "Cleaning cannot be started from this plan: this robot's rooms can only be chosen on the plan where the card draws them.",
    );
    expect(firstPlan(card)?.querySelector("ul.room-list")).toBeNull();
  });

  it("tells a non-administrator to ask an administrator for the mapping, and an administrator where to make it", async () => {
    withFirstFloorPlan({ content: { kind: "picture_only", reason: "mapping_absent" } });
    expect(text(firstPlan(await mountAs(false))?.querySelector('[role="note"]'))).toContain(
      "Ask an administrator to map your vacuum's segments to areas.",
    );
    const admin = text(firstPlan(await mountAs(true))?.querySelector('[role="note"]'));
    expect(admin).toContain("entity settings");
    expect(admin).not.toContain("Ask an administrator");
  });

  it("speaks the user's language", async () => {
    withFirstFloorPlan({ content: { kind: "picture_only", reason: "no_clean_area" } });
    const hass = fixtureHass();
    hass.language = "fr";
    hass.locale = { language: "fr" };
    const card = await mount(hass);
    expect(text(firstPlan(card)?.querySelector('[role="note"]'))).toContain(
      "ne se choisissent que sur le plan où la carte les dessine",
    );
  });

  it("marks the note with an icon, not with colour alone", async () => {
    withFirstFloorPlan({ content: { kind: "picture_only", reason: "no_clean_area" } });
    const note = firstPlan(await mount(fixtureHass()))?.querySelector('[role="note"]');
    expect(note?.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });
});

describe("VacuumMapCard « no floor » notes", () => {
  function withNoFloorReasons(reasons: Plan["placement"] & { kind: "no_floor" }): void {
    changeModel((model) => ({
      ...model,
      noFloor: model.noFloor.map((plan, i) =>
        i === 0 ? { ...plan, mapName: undefined, placement: reasons, content: { kind: "areas", items: [] } } : plan,
      ),
    }));
  }

  function noFloorNote(card: TestCard): Element | null | undefined {
    return shadowOf(card).querySelector(".no-floor .plan")?.querySelector('[role="note"]');
  }

  it("lists the fixes that place a plan on a floor, then what comes on top", async () => {
    withNoFloorReasons({
      kind: "no_floor",
      reasons: ["assign_area_to_floor_plan", "add_floor_alias", "cannot_tell_shown_map"],
    });
    const note = noFloorNote(await mount(fixtureHass()));
    expect(text(note?.querySelector("p"))).toBe(
      "To show this plan on a floor, ask an administrator to do one of these in Home Assistant:",
    );
    expect([...(note?.querySelectorAll("li") ?? [])].map(text)).toStrictEqual([
      "Assign this floor plan to an area that is on a floor.",
      "Add this map's name as an alias of a floor.",
    ]);
    expect(text(note)).toContain("The card cannot tell which of the robot's maps this picture shows");
  });

  it("explains that the card cannot tell which map a rooms map shows, without a list of fixes", async () => {
    withNoFloorReasons({ kind: "no_floor", reasons: ["cannot_tell_shown_map"] });
    const note = noFloorNote(await mount(fixtureHass()));
    expect(text(note)).toBe(
      "The card cannot tell which of the robot's maps this picture shows, so it cannot place it on a floor.",
    );
    expect(note?.querySelector("ul")).toBeNull();
  });

  it("gives a plan one note, with why it shows its picture only and why it is on no floor", async () => {
    changeModel((model) => ({
      ...model,
      noFloor: model.noFloor.map((plan, i) =>
        i === 0
          ? {
              ...plan,
              placement: { kind: "no_floor", reasons: ["cannot_tell_shown_map"] },
              content: { kind: "picture_only", reason: "no_clean_area" },
            }
          : plan,
      ),
    }));
    const plan = shadowOf(await mount(fixtureHass())).querySelector(".no-floor .plan");
    expect(plan?.querySelectorAll('[role="note"]')).toHaveLength(1);
    expect([...(plan?.querySelectorAll('[role="note"] p') ?? [])].map(text)).toStrictEqual([
      "Cleaning cannot be started from this plan: this robot's rooms can only be chosen on the plan where the card draws them.",
      "The card cannot tell which of the robot's maps this picture shows, so it cannot place it on a floor.",
    ]);
  });

  it("adds no note to a plan on a floor", async () => {
    withFirstFloorPlan({ content: { kind: "areas", items: AREAS } });
    expect(firstPlan(await mount(fixtureHass()))?.querySelector('[role="note"]')).toBeNull();
  });
});

describe("VacuumMapCard robot notes", () => {
  function withIssues(issues: readonly (RoomsMapIssue | undefined)[]): void {
    changeModel((model) => ({
      ...model,
      robots: model.robots.map((robot, i) => ({ ...robot, roomsMapIssue: issues[i] })),
    }));
  }

  function robotNotes(card: TestCard): string[] {
    return [...shadowOf(card).querySelectorAll(".robot-notes p, .robot-notes li")].map(text);
  }

  it("gives each robot whose rooms map adds no plan one line under the plans, by its name", async () => {
    withIssues([{ kind: "no_outlines" }, { kind: "unsupported", reason: "too_many_rooms" }]);
    const card = await mount(fixtureHass());
    const notes = robotNotes(card);
    expect(notes).toHaveLength(2);
    expect(notes[0]).toMatch(/^.+: no room outlines yet$/);
    expect(notes[1]).toMatch(/^.+: room outlines could not be read \(too_many_rooms\)$/);
    expect(notes.some((note) => note.includes("vacuum."))).toBe(false);
    const content = shadowOf(card).querySelector(".content");
    expect(content?.lastElementChild?.classList.contains("robot-notes")).toBe(true);
  });

  it("says the same for an absent rooms map", async () => {
    withIssues([{ kind: "absent" }]);
    expect(robotNotes(await mount(fixtureHass()))).toHaveLength(1);
  });

  it("keeps outlines not there yet as a note and unreadable ones as a warning", async () => {
    withIssues([{ kind: "no_outlines" }, { kind: "unsupported", reason: "too_many_rooms" }]);
    const card = await mount(fixtureHass());
    const kinds = [...shadowOf(card).querySelectorAll(".robot-notes .notice")].map((n) => n.className);
    expect(kinds).toStrictEqual(["notice notice-info", "notice notice-warning"]);
  });

  it("renders a robot name with markup as text", async () => {
    withIssues([{ kind: "no_outlines" }, { kind: "no_outlines" }]);
    const hass = fixtureHass();
    hass.states = renamed(hass.states, "<b>Bot</b>");
    const card = await mount(hass);
    expect(robotNotes(card)).toStrictEqual(["<b>Bot</b>: no room outlines yet", "<b>Bot</b>: no room outlines yet"]);
    expect(shadowOf(card).querySelector(".robot-notes b")).toBeNull();
  });

  it("follows a renamed robot and a user who becomes an administrator", async () => {
    changeModel((model) => ({
      ...model,
      floors: model.floors.map((floor, index) =>
        index === 0
          ? { ...floor, plan: { ...floor.plan, content: { kind: "picture_only", reason: "mapping_absent" } } }
          : floor,
      ),
      robots: model.robots.map((robot) => ({ ...robot, roomsMapIssue: { kind: "no_outlines" } })),
    }));
    const base = fixtureHass();
    const card = await mount(base);
    card.hass = nextHass(base, { states: renamed(base.states, "Renamed"), user: { is_admin: true } });
    await card.updateComplete;
    expect(robotNotes(card).every((note) => note.startsWith("Renamed:"))).toBe(true);
    expect(text(firstPlan(card)?.querySelector('[role="note"]'))).toContain("in its entity settings");
  });

  it("shows no robot note when every rooms map adds a plan", async () => {
    withIssues([]);
    expect(shadowOf(await mount(fixtureHass())).querySelector(".robot-notes")).toBeNull();
  });
});

describe("VacuumMapCard notes for a non-administrator", () => {
  it("asks an administrator for the « no floor » fixes, which are registry writes", async () => {
    changeModel((model) => ({
      ...model,
      noFloor: model.noFloor.map((plan, i) =>
        i === 0
          ? {
              ...plan,
              placement: { kind: "no_floor", reasons: ["assign_area_to_floor_plan", "add_floor_alias"] },
              content: { kind: "areas", items: AREAS },
            }
          : plan,
      ),
    }));
    const lead = (card: TestCard) => text(shadowOf(card).querySelector('.no-floor .plan [role="note"] p'));
    expect(lead(await mountAs(false))).toBe(
      "To show this plan on a floor, ask an administrator to do one of these in Home Assistant:",
    );
    expect(lead(await mountAs(true))).toBe("To show this plan on a floor, do one of these in Home Assistant:");
  });
});

describe("VacuumMapCard room list styles", () => {
  it("gives each button a 44 px target and the rooms' three-band focus ring", async () => {
    withFirstFloorPlan({ content: { kind: "areas", items: AREAS } });
    const buttons = [...(firstPlan(await mount(fixtureHass()))?.querySelectorAll(".room-list button") ?? [])];
    expect(buttons.every((button) => button.classList.contains("outlined-button"))).toBe(true);
    const rules = stylesText(VacuumMapCard);
    expect(rules).toMatch(/\.outlined-button\s*\{[^}]*min-height:\s*44px/);
    expect(rules).toMatch(
      /\.outlined-button:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--ha-color-focus[^}]*outline-offset:\s*2px[^}]*0 0 0 2px var\(--card-background-color[^}]*0 0 0 6px var\(--primary-text-color/,
    );
  });

  it("keeps the robots' notes apart from the last plan", () => {
    expect(stylesText(VacuumMapCard)).toMatch(/\.robot-notes\s*\{[^}]*margin-top:\s*var\(--ha-space-6/);
  });
});
