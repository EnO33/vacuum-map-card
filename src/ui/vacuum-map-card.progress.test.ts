// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { FakeFrontendHass } from "../../test/fakes/frontend-hass";
import serviceErrors from "../../test/fixtures/ha-core/synthetic/service_errors.json" with { type: "json" };
import {
  collapsedText,
  firstPlan,
  fixtureHass,
  hassAs,
  mount,
  nextHass,
  pictures,
  settle,
  shadowOf,
  statusText,
  type TestCard,
  useTestCard,
} from "../../test/helpers/card";
import { setCardHelpers, useCardHelpers } from "../../test/helpers/card-helpers";
import { expectNoConsoleOutput } from "../../test/helpers/no-console";
import { chooseFirstRobot, selectFirstRoom, usePickerElements } from "../../test/helpers/picker";
import { img, loaded } from "../../test/helpers/plan-picture";
import { roombaPlusStates } from "../../test/helpers/roomba-plus-states";
import { deepActiveElement } from "./focus";

useTestCard();
expectNoConsoleOutput();
useCardHelpers();

usePickerElements();

const NOT_LINKED = serviceErrors.find(
  ({ error }) => "translation_key" in error && error.translation_key === "area_mapping_not_configured",
)?.error;

/** Confirms every question, through Home Assistant's card helpers. */
function confirmAll(): void {
  setCardHelpers(() => Promise.resolve({ showConfirmationDialog: () => Promise.resolve(true) }));
}

/** Selects the first drawn room, chooses its first robot that can start, and lets the start run; that robot's id. */
async function startFirstRoom(card: TestCard): Promise<{ robot: string; room: string }> {
  const { name } = await selectFirstRoom(card);
  const robot = await chooseFirstRobot(card);
  await settle(card);
  await settle(card);
  return { robot, room: name };
}

/** A new `hass` where the robot reports `state`, as the frontend makes one on each state change. */
async function report(card: TestCard, base: FakeFrontendHass, robot: string, state: string): Promise<void> {
  const states = roombaPlusStates();
  states[robot] = { ...Object(states[robot]), state };
  card.hass = nextHass(base, { states });
  await settle(card);
}

function progressItems(card: TestCard): Element[] {
  return [...(firstPlanWithProgress(card)?.querySelectorAll(".progress-item") ?? [])];
}

function firstPlanWithProgress(card: TestCard): Element | null {
  return shadowOf(card).querySelector(".plan:has(.progress-list)") ?? null;
}

function dismissButton(card: TestCard): HTMLButtonElement {
  const found = shadowOf(card).querySelector(".progress-dismiss");
  if (!(found instanceof HTMLButtonElement)) throw new Error("no dismiss button");
  return found;
}

describe("VacuumMapCard progress", () => {
  it("shows the progress under the room's plan and announces each phase once", async () => {
    confirmAll();
    const hass = fixtureHass();
    const card = await mount(hass);
    const { robot, room } = await startFirstRoom(card);
    const picture = pictures(card).find((p) => p.progress.length > 0);
    expect(picture?.progress.map((entry) => [entry.vacuumEntityId, entry.phase])).toEqual([[robot, "starting"]]);
    expect(statusText(card)).toBe(`Robot One is starting to clean ${room}.`);
    const list = firstPlanWithProgress(card)?.querySelector(".progress-list");
    expect(list?.getAttribute("aria-label")).toMatch(/^Cleaning progress, /);
    await report(card, hass, robot, "cleaning");
    expect(statusText(card)).toBe(`Robot One is cleaning ${room}.`);
    expect(collapsedText(progressItems(card)[0])).toBe(`Robot One is cleaning ${room}. Dismiss`);
    await report(card, hass, robot, "returning");
    expect(statusText(card)).toBe(`Robot One finished cleaning ${room}.`);
    expect(progressItems(card)[0]?.classList.contains("tone-done")).toBe(true);
  });

  it("keeps done until dismissed, then gives the focus back to the room and drops its words", async () => {
    confirmAll();
    const hass = fixtureHass();
    const card = await mount(hass);
    const picture = pictures(card).find((p) => p.rooms !== undefined && p.rooms.rooms.size > 0);
    if (!picture) throw new Error("no outlines plan");
    loaded(img(picture), 1000, 1000);
    await picture.updateComplete;
    const { robot, room } = await startFirstRoom(card);
    await report(card, hass, robot, "cleaning");
    await report(card, hass, robot, "docked");
    await report(card, hass, robot, "idle");
    expect(progressItems(card)).toHaveLength(1);
    const button = dismissButton(card);
    expect(button.getAttribute("aria-label")).toMatch(/^Dismiss, Robot One, /);
    button.focus();
    button.click();
    await settle(card);
    expect(shadowOf(card).querySelector(".progress-list")).toBeNull();
    expect(pictures(card).every((p) => p.progress.length === 0)).toBe(true);
    expect(deepActiveElement()?.getAttribute("aria-label")).toBe(room);
    expect(statusText(card)).toBe("");
  });

  it("keeps the focus in the card when the room is not drawn", async () => {
    confirmAll();
    const card = await mount(fixtureHass());
    await startFirstRoom(card);
    dismissButton(card).focus();
    dismissButton(card).click();
    await settle(card);
    expect(deepActiveElement()).toBe(shadowOf(card).querySelector(".content"));
  });

  it("keeps the progress while the card leaves the page and comes back", async () => {
    confirmAll();
    const hass = fixtureHass();
    const card = await mount(hass);
    const { robot, room } = await startFirstRoom(card);
    await report(card, hass, robot, "cleaning");
    card.remove();
    await settle(card);
    document.body.append(card);
    await settle(card);
    expect(collapsedText(progressItems(card)[0])).toBe(`Robot One is cleaning ${room}. Dismiss`);
    expect(statusText(card)).toBe("");
    await report(card, hass, robot, "returning");
    expect(statusText(card)).toBe(`Robot One finished cleaning ${room}.`);
  });

  it("re-renders nothing for 50 updates of other entities while a robot is cleaning", async () => {
    confirmAll();
    const hass = fixtureHass();
    const card = await mount(hass);
    const { robot } = await startFirstRoom(card);
    await report(card, hass, robot, "cleaning");
    const renders = card.renders;
    const pictureUpdates = pictures(card).map((p) => [p, p.updateComplete] as const);
    for (let i = 0; i < 50; i++) {
      const states = roombaPlusStates();
      states[robot] = { ...Object(states[robot]), state: "cleaning" };
      states["sensor.unrelated"] = { entity_id: "sensor.unrelated", state: String(i), attributes: {} };
      card.hass = nextHass(hass, { states });
    }
    await settle(card);
    expect(card.renders).toBe(renders);
    for (const [picture, update] of pictureUpdates) expect(picture.updateComplete).toBe(update);
  });

  it("tells a refused start with the card's own words; a non-administrator asks an administrator", async () => {
    confirmAll();
    const hass = hassAs(false);
    hass.behaviour = { kind: "reject", value: structuredClone(NOT_LINKED) };
    const card = await mount(hass);
    const { room } = await startFirstRoom(card);
    const item = progressItems(card)[0];
    expect(item?.classList.contains("tone-failed")).toBe(true);
    expect([...(item?.querySelectorAll("p") ?? [])].map((p) => p.textContent)).toEqual([
      `Robot One could not be sent to ${room}.`,
      "The robot's segments are not mapped to areas yet.",
      "Ask an administrator to map your vacuum's segments to areas.",
    ]);
    expect(item?.querySelector(".settings-button")).toBeNull();
    expect(statusText(card)).toContain("Ask an administrator");
  });

  it("gives an administrator the vacuum's settings with a missing mapping", async () => {
    confirmAll();
    const hass = hassAs(true);
    hass.behaviour = { kind: "reject", value: structuredClone(NOT_LINKED) };
    const card = await mount(hass);
    await startFirstRoom(card);
    const item = progressItems(card)[0];
    expect(item?.querySelector(".settings-button")?.textContent?.trim()).toBe("Open vacuum settings");
    expect(collapsedText(item)).toContain("Map the vacuum's segments to areas in its entity settings.");
  });

  it("says status unknown while the robot is unavailable, then goes on", async () => {
    confirmAll();
    const hass = fixtureHass();
    const card = await mount(hass);
    const { robot, room } = await startFirstRoom(card);
    await report(card, hass, robot, "cleaning");
    await report(card, hass, robot, "unavailable");
    expect(progressItems(card)[0]?.classList.contains("tone-unknown")).toBe(true);
    expect(statusText(card)).toBe(`Robot One is cleaning ${room}.Status unknown: Robot One is unavailable.`);
    await report(card, hass, robot, "cleaning");
    expect(progressItems(card)[0]?.classList.contains("tone-cleaning")).toBe(true);
  });

  it("speaks French", async () => {
    confirmAll();
    const hass = hassAs(true, "fr");
    const card = await mount(hass);
    const { robot, room } = await startFirstRoom(card);
    await report(card, hass, robot, "cleaning");
    expect(statusText(card)).toBe(`Robot One nettoie « ${room} ».`);
    expect(dismissButton(card).textContent?.trim()).toBe("Masquer");
  });

  it("counts the progress in the masonry size", async () => {
    confirmAll();
    const card = await mount(fixtureHass());
    const before = card.getCardSize();
    await startFirstRoom(card);
    expect(card.getCardSize()).toBe(before + 2);
  });

  it("keeps the status line in place and never puts a dismiss button in it", async () => {
    confirmAll();
    const card = await mount(fixtureHass());
    await startFirstRoom(card);
    expect(firstPlan(card)).not.toBeNull();
    expect(shadowOf(card).querySelector('[role="status"] button')).toBeNull();
  });
});
