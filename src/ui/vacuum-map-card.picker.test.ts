// @vitest-environment happy-dom
import { beforeAll, describe, expect, it } from "vitest";
import {
  collapsedText,
  fixtureHass,
  hassAs,
  injected,
  mount,
  nextHass,
  pictures,
  settle,
  shadowOf,
  statusText,
  type TestCard,
  useTestCard,
  wrapBuilder,
} from "../../test/helpers/card";
import { expectNoConsoleOutput } from "../../test/helpers/no-console";
import { pickerDialog, selectFirstRoom, settlePicker } from "../../test/helpers/picker";
import { roombaPlusStates } from "../../test/helpers/roomba-plus-states";
import { deepActiveElement } from "./focus";
import { PICKER_DIALOG_ELEMENT, PickerDialog } from "./picker-dialog";
import { defineOnce } from "./register";
import { ROBOT_PICKER_ELEMENT, RobotPicker } from "./robot-picker";
import { roomSelectedEvent } from "./room-selected";

useTestCard();
expectNoConsoleOutput();

beforeAll(() => {
  defineOnce(customElements, ROBOT_PICKER_ELEMENT, RobotPicker);
  defineOnce(customElements, PICKER_DIALOG_ELEMENT, PickerDialog);
});

function dialogOf(card: TestCard): HTMLDialogElement | null {
  const host = pickerDialog(card);
  return host ? shadowOf(host).querySelector("dialog") : null;
}

/** The robot list of the open picker; `undefined` while it is closed. */
function picker(card: TestCard): RobotPicker | undefined {
  const host = pickerDialog(card);
  if (!host || !dialogOf(card)?.open) return undefined;
  const found = shadowOf(host).querySelector(ROBOT_PICKER_ELEMENT);
  return found instanceof RobotPicker ? found : undefined;
}

/** The fixture states with a rooms map that lists no room: the plan loses every room it had (re-mapping). */
function withoutRooms(imageEntityId: string): Record<string, unknown> {
  const states = roombaPlusStates();
  const map = Object(states[imageEntityId]);
  states[imageEntityId] = { ...map, attributes: { ...Object(map.attributes), rooms: {} } };
  return states;
}

describe("VacuumMapCard robot picker", () => {
  it("shows no picker until a room is selected", async () => {
    const card = await mount(fixtureHass());
    expect(picker(card)).toBeUndefined();
  });

  it("opens the picker for a selected room, headed by its name", async () => {
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
    await settlePicker(card);
    expect(picker(card)?.item?.kind).toBe("area");
    expect(picker(card)?.itemName).toBe(collapsedText(button));
    expect(pickerDialog(card)?.opener).toBe(button);
  });

  it("never offers a robot the robots option leaves out, nor opens for its rooms", async () => {
    const all = await mount(fixtureHass());
    const theirs = await selectFirstRoom(all);
    expect(picker(all)?.candidates.map((candidate) => candidate.vacuumEntityId)).toStrictEqual(["vacuum.robot_one"]);
    const card = await mount(fixtureHass(), { robots: ["vacuum.robot_two"] });
    await selectFirstRoom(card);
    expect(picker(card)?.candidates.map((candidate) => candidate.vacuumEntityId)).toStrictEqual(["vacuum.robot_two"]);
    pictures(card)[0]?.dispatchEvent(roomSelectedEvent(theirs.item));
    await settlePicker(card);
    expect(picker(card)?.itemName).not.toBe(theirs.name);
  });

  it("anchors the picker to the room that opened it and gives it the focus back on close", async () => {
    const card = await mount(fixtureHass());
    const { opener } = await selectFirstRoom(card);
    expect(pickerDialog(card)?.opener).toBe(opener);
    dialogOf(card)?.dispatchEvent(new Event("cancel", { cancelable: true }));
    await settlePicker(card);
    expect(picker(card)).toBeUndefined();
    expect(deepActiveElement()).toBe(opener);
  });

  it("keeps the picker closed after the user closed it, through later updates", async () => {
    const hass = fixtureHass();
    const card = await mount(hass);
    await selectFirstRoom(card);
    dialogOf(card)?.dispatchEvent(new Event("cancel", { cancelable: true }));
    await settlePicker(card);
    card.hass = nextHass(hass, { user: { is_admin: true } });
    await settlePicker(card);
    expect(picker(card)).toBeUndefined();
  });

  it("closes the picker and says so when its room leaves the plans", async () => {
    const hass = fixtureHass();
    const card = await mount(hass);
    const { item, name } = await selectFirstRoom(card);
    card.hass = nextHass(hass, { states: withoutRooms(item.imageEntityId) });
    await settle(card);
    await settlePicker(card);
    expect(picker(card)).toBeUndefined();
    expect(statusText(card)).toContain(`${name} is no longer on the plans`);
  });

  it("clears that message on the next selection", async () => {
    const hass = fixtureHass();
    const card = await mount(hass);
    const { item } = await selectFirstRoom(card);
    card.hass = nextHass(hass, { states: withoutRooms(item.imageEntityId) });
    await settle(card);
    card.hass = nextHass(hass, { states: roombaPlusStates() });
    await settle(card);
    await selectFirstRoom(card);
    expect(statusText(card)).not.toContain("no longer on the plans");
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

  it("marks the selected room on its plan while the picker is open", async () => {
    const card = await mount(fixtureHass());
    const { item } = await selectFirstRoom(card);
    const onPlan = pictures(card).find((p) => p.imageEntityId === item.imageEntityId);
    expect(onPlan?.selected).toBe(item.kind === "room" ? item.regionId : undefined);
    expect(pictures(card).filter((p) => p.selected !== undefined)).toHaveLength(1);
    dialogOf(card)?.dispatchEvent(new Event("cancel", { cancelable: true }));
    await settlePicker(card);
    expect(onPlan?.selected).toBeUndefined();
  });

  it("does not reopen the picker by itself when the card comes back on the page", async () => {
    const card = await mount(fixtureHass());
    await selectFirstRoom(card);
    card.remove();
    document.body.append(card);
    await settle(card);
    await settlePicker(card);
    expect(picker(card)).toBeUndefined();
  });

  it("does not reopen the picker by itself after the plans were loading again", async () => {
    let loading = false;
    injected.current.createModelBuilder = wrapBuilder((build) => (h, s) => {
      const model = build(h, s);
      return loading ? { ...model, loading: true } : model;
    });
    const hass = fixtureHass();
    const card = await mount(hass);
    await selectFirstRoom(card);
    loading = true;
    card.hass = nextHass(hass, {});
    await settlePicker(card);
    loading = false;
    card.hass = nextHass(hass, {});
    await settle(card);
    await settlePicker(card);
    expect(picker(card)).toBeUndefined();
  });

  it("ignores a selection of an item the model does not have", async () => {
    const card = await mount(fixtureHass());
    const picture = pictures(card)[0];
    picture?.dispatchEvent(roomSelectedEvent({ kind: "room", imageEntityId: "image.nothing", regionId: "1" }));
    await settlePicker(card);
    expect(picker(card)).toBeUndefined();
    expect(statusText(card)).toBe("");
  });

  it("ignores a room-selected event the card did not build", async () => {
    const card = await mount(fixtureHass());
    const detail = { kind: "room", imageEntityId: pictures(card)[0]?.imageEntityId, regionId: "1" };
    pictures(card)[0]?.dispatchEvent(new CustomEvent("room-selected", { detail, bubbles: true }));
    await card.updateComplete;
    expect(picker(card)).toBeUndefined();
  });
});
