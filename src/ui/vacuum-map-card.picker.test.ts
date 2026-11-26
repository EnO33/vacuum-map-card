// @vitest-environment happy-dom
import { beforeAll, describe, expect, it } from "vitest";
import {
  collapsedText,
  fixtureHass,
  hassAs,
  mount,
  nextHass,
  pictures,
  settle,
  shadowOf,
  type TestCard,
  useTestCard,
} from "../../test/helpers/card";
import { expectNoConsoleOutput } from "../../test/helpers/no-console";
import { roombaPlusStates } from "../../test/helpers/roomba-plus-states";
import type { ItemRef } from "../app/robots-for-item/robots-for-item";
import { defineOnce } from "./register";
import { ROBOT_PICKER_ELEMENT, RobotPicker } from "./robot-picker";
import { roomSelectedEvent } from "./room-selected";

useTestCard();
expectNoConsoleOutput();

beforeAll(() => {
  defineOnce(customElements, ROBOT_PICKER_ELEMENT, RobotPicker);
});

function picker(card: TestCard): RobotPicker | undefined {
  const found = shadowOf(card).querySelector(ROBOT_PICKER_ELEMENT);
  return found instanceof RobotPicker ? found : undefined;
}

/** The first drawn room of the card's first outlines plan, selected from its picture. */
async function selectFirstRoom(card: TestCard): Promise<{ item: ItemRef; name: string }> {
  const picture = pictures(card).find((p) => p.rooms !== undefined && p.rooms.rooms.size > 0);
  const [room] = picture?.rooms?.rooms.values() ?? [];
  if (!picture || !room) throw new Error("no drawn room");
  const item: ItemRef = { kind: "room", imageEntityId: picture.imageEntityId, regionId: room.regionId };
  picture.dispatchEvent(roomSelectedEvent(item));
  await card.updateComplete;
  return { item, name: room.name };
}

describe("VacuumMapCard robot picker", () => {
  it("shows no picker until a room is selected", async () => {
    const card = await mount(fixtureHass());
    expect(picker(card)).toBeUndefined();
  });

  it("lists the robots for a selected room under the plans, headed by its name", async () => {
    const card = await mount(fixtureHass());
    const { item, name } = await selectFirstRoom(card);
    const shown = picker(card);
    expect(shown?.item).toEqual(item);
    expect(shown?.itemName).toBe(name);
    expect(shown?.candidates.length).toBeGreaterThan(0);
    expect(shown?.candidates[0]?.vacuumEntityId.startsWith("vacuum.")).toBe(true);
    await shown?.updateComplete;
    expect(collapsedText(shadowOf(shown ?? card).querySelector("h2"))).toBe(name);
  });

  it("lists the robots for an area chosen from a room list", async () => {
    const card = await mount(fixtureHass());
    const button = shadowOf(card).querySelector(".room-list button");
    if (!(button instanceof HTMLButtonElement)) throw new Error("no room list");
    button.click();
    await card.updateComplete;
    expect(picker(card)?.item?.kind).toBe("area");
    expect(picker(card)?.itemName).toBe(collapsedText(button));
  });

  it("keeps the picker's robot names when another part of the view changes", async () => {
    const hass = hassAs(false);
    const card = await mount(hass);
    await selectFirstRoom(card);
    const names = picker(card)?.robotNames;
    card.hass = nextHass(hass, { user: { is_admin: true } });
    await card.updateComplete;
    expect(picker(card)?.robotNames).toBe(names);
  });

  it("follows the robots' states while the room stays selected", async () => {
    const hass = fixtureHass();
    const card = await mount(hass);
    await selectFirstRoom(card);
    const [first] = picker(card)?.candidates ?? [];
    if (!first) throw new Error("no robot listed");
    expect(first.state).not.toBe("cleaning");
    const states = roombaPlusStates();
    states[first.vacuumEntityId] = { ...Object(states[first.vacuumEntityId]), state: "cleaning" };
    card.hass = nextHass(hass, { states });
    await settle(card);
    expect(picker(card)?.candidates[0]?.state).toBe("cleaning");
  });

  it("ignores a selection of an item the model does not have", async () => {
    const card = await mount(fixtureHass());
    const picture = pictures(card)[0];
    picture?.dispatchEvent(roomSelectedEvent({ kind: "room", imageEntityId: "image.nothing", regionId: "1" }));
    await card.updateComplete;
    expect(picker(card)).toBeUndefined();
  });

  it("ignores a room-selected event the card did not build", async () => {
    const card = await mount(fixtureHass());
    const detail = { kind: "room", imageEntityId: pictures(card)[0]?.imageEntityId, regionId: "1" };
    pictures(card)[0]?.dispatchEvent(new CustomEvent("room-selected", { detail, bubbles: true }));
    await card.updateComplete;
    expect(picker(card)).toBeUndefined();
  });
});
