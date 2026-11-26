// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { changeModel, fixtureHass, mount, pictures, shadowOf, useTestCard } from "../../test/helpers/card";
import { expectNoConsoleOutput } from "../../test/helpers/no-console";
import { planOf, snapshotFixtures, snapshotOf } from "../../test/helpers/rooms-snapshot";
import type { Plan } from "../app/floor-model/floor-model";
import { type RoomsPlan, undrawableRooms } from "../domain/plan/rooms-plan";

useTestCard();
expectNoConsoleOutput();

/** The real model, with every outlines plan's rooms replaced by `plan`. */
function withOutlines(plan: RoomsPlan): void {
  const replace = (shown: Plan): Plan =>
    shown.content.kind === "outlines" ? { ...shown, content: { ...shown.content, plan } } : shown;
  changeModel((model) => ({
    ...model,
    floors: model.floors.map((floor) => ({ ...floor, plan: replace(floor.plan) })),
    noFloor: model.noFloor.map(replace),
  }));
}

function note(card: HTMLElement): string | undefined {
  return shadowOf(card).querySelector(".plan .not-drawn")?.textContent?.trim();
}

describe("VacuumMapCard rooms", () => {
  it("gives each outlines plan's rooms to its picture, and none to a picture-only plan", async () => {
    const card = await mount(fixtureHass());
    const withRooms = pictures(card).filter((p) => p.rooms !== undefined);
    expect(withRooms.length).toBeGreaterThan(0);
    expect(withRooms.length).toBeLessThan(pictures(card).length);
  });

  it("tells each picture its plan's image entity, for the rooms chosen on it", async () => {
    const card = await mount(fixtureHass());
    const ids = pictures(card).map((p) => p.imageEntityId);
    expect(ids.every((id) => id.startsWith("image."))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("lists the rooms it cannot draw under their plan", async () => {
    const plan = planOf(snapshotOf(snapshotFixtures.withoutOutline));
    withOutlines(plan);
    const card = await mount(fixtureHass());
    const names = undrawableRooms(plan).map((room) => room.name);
    expect(names).toHaveLength(1);
    expect(note(card)).toBe(`Rooms not drawn: ${names.join("")}`);
  });

  it("joins several names as a list in the user's language", async () => {
    const plan = planOf(snapshotOf(snapshotFixtures.withoutOutline));
    const [undrawn] = undrawableRooms(plan);
    if (!undrawn) throw new Error("no undrawn room");
    const rooms = new Map([...plan.rooms, ["x", { ...undrawn, regionId: "x", name: "Attic" }]]);
    withOutlines({ ...plan, rooms });
    const hass = fixtureHass();
    hass.language = "fr";
    hass.locale = { language: "fr" };
    const card = await mount(hass);
    expect(note(card)).toBe(`Pièces non dessinées : ${undrawn.name} et Attic`);
  });

  it("puts the note right after the figure, so the caption stays next to its picture", async () => {
    withOutlines(planOf(snapshotOf(snapshotFixtures.withoutOutline)));
    const card = await mount(fixtureHass());
    const note = shadowOf(card).querySelector(".not-drawn");
    expect(note?.previousElementSibling?.localName).toBe("figure");
    expect(note?.previousElementSibling?.lastElementChild?.localName).toBe("figcaption");
  });

  it("adds no note when the plan shows no picture", async () => {
    const plan = planOf(snapshotOf(snapshotFixtures.withoutOutline));
    const replace = (shown: Plan): Plan =>
      shown.content.kind === "outlines"
        ? { ...shown, pictureState: "unknown", content: { ...shown.content, plan } }
        : shown;
    changeModel((model) => ({ ...model, noFloor: model.noFloor.map(replace) }));
    const card = await mount(fixtureHass());
    expect(note(card)).toBeUndefined();
  });

  it("adds no note when every room is drawn", async () => {
    const card = await mount(fixtureHass());
    expect(note(card)).toBeUndefined();
  });
});
