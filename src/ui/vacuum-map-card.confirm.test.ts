// @vitest-environment happy-dom
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  fixtureHass,
  hassAs,
  mount,
  nextHass,
  settle,
  shadowOf,
  statusText,
  type TestCard,
  useTestCard,
} from "../../test/helpers/card";
import { setCardHelpers, useCardHelpers } from "../../test/helpers/card-helpers";
import { buttonNamed, dialogOf, titleOf } from "../../test/helpers/confirm-dialog";
import { expectNoConsoleOutput } from "../../test/helpers/no-console";
import { pickerDialog, selectFirstRoom } from "../../test/helpers/picker";
import { roombaPlusStates } from "../../test/helpers/roomba-plus-states";
import { CONFIRM_DIALOG_ELEMENT, ConfirmDialog } from "./confirm-dialog";
import { deepActiveElement } from "./focus";
import { PICKER_DIALOG_ELEMENT, PickerDialog } from "./picker-dialog";
import { defineOnce } from "./register";
import { ROBOT_PICKER_ELEMENT, RobotChosenEvent, RobotPicker } from "./robot-picker";

useTestCard();
expectNoConsoleOutput();

beforeAll(() => {
  defineOnce(customElements, ROBOT_PICKER_ELEMENT, RobotPicker);
  defineOnce(customElements, PICKER_DIALOG_ELEMENT, PickerDialog);
  defineOnce(customElements, CONFIRM_DIALOG_ELEMENT, ConfirmDialog);
});

useCardHelpers();

/** The open picker window. */
function picker(card: TestCard): PickerDialog {
  const found = pickerDialog(card);
  if (!found) throw new Error("no picker window");
  return found;
}

function ownDialog(card: TestCard): ConfirmDialog {
  const found = shadowOf(card).querySelector(CONFIRM_DIALOG_ELEMENT);
  if (!(found instanceof ConfirmDialog)) throw new Error("no confirmation element");
  return found;
}

/** Home Assistant's card helpers, answering `answer` to every confirmation, with the parameters kept. */
function standardConfirmation(answer: boolean | (() => Promise<boolean>)) {
  const show = vi.fn((_element: unknown, _params: unknown) =>
    typeof answer === "function" ? answer() : Promise.resolve(answer),
  );
  setCardHelpers(() => Promise.resolve({ showConfirmationDialog: show }));
  return show;
}

/** The first robot that can start, chosen in the open picker; its entity id. */
async function chooseFirstRobot(card: TestCard): Promise<string> {
  const picked = picker(card).picked;
  const startable = picked?.candidates.find((c) => c.choice.kind !== "not_startable");
  if (!picked || !startable) throw new Error("no startable robot");
  picker(card).dispatchEvent(new RobotChosenEvent({ item: picked.item, vacuumEntityId: startable.vacuumEntityId }));
  return startable.vacuumEntityId;
}

/** A held Enter dispatched on the page; `true` when something dropped it. */
function repeatPrevented(): boolean {
  const event = new KeyboardEvent("keydown", { key: "Enter", repeat: true, bubbles: true, cancelable: true });
  document.body.dispatchEvent(event);
  return event.defaultPrevented;
}

function fail(): never {
  throw new Error("nothing picked");
}

/** Lets the confirmation, the call and the render that follows run. */
async function flush(card: TestCard): Promise<void> {
  await settle(card);
  await ownDialog(card).updateComplete;
  await settle(card);
}

describe("VacuumMapCard confirmation and start", () => {
  it("asks Home Assistant's confirmation with the robot, the action and the room, then sends one call", async () => {
    const show = standardConfirmation(true);
    const hass = fixtureHass();
    const card = await mount(hass);
    await selectFirstRoom(card);
    await chooseFirstRobot(card);
    await flush(card);
    expect(show).toHaveBeenCalledTimes(1);
    const [element, params] = show.mock.calls[0] ?? [];
    expect(element).toBe(card);
    expect(params).toMatchObject({ confirmText: "Start", dismissText: "Cancel", destructive: false });
    expect(JSON.stringify(params)).toMatch(/"title":"Send Robot (One|Two) to [a-z ,]+ .+\?"/);
    expect(hass.calls).toHaveLength(1);
    expect(statusText(card)).toMatch(/^Start sent to Robot (One|Two)\.$/);
  });

  it("closes the picker before the confirmation opens", async () => {
    let pickerOpenWhenAsked: boolean | undefined;
    const card = await mount(fixtureHass());
    standardConfirmation(() => {
      pickerOpenWhenAsked = shadowOf(picker(card)).querySelector("dialog")?.open;
      return Promise.resolve(false);
    });
    await selectFirstRoom(card);
    await chooseFirstRobot(card);
    await flush(card);
    expect(pickerOpenWhenAsked).toBe(false);
  });

  it("sends nothing and says nothing when the user cancels", async () => {
    standardConfirmation(false);
    const hass = fixtureHass();
    const card = await mount(hass);
    await selectFirstRoom(card);
    await chooseFirstRobot(card);
    await flush(card);
    expect(hass.calls).toEqual([]);
    expect(statusText(card)).toBe("");
  });

  it("sends one call for a double activation", async () => {
    let answer: (confirmed: boolean) => void = () => undefined;
    const show = standardConfirmation(() => new Promise<boolean>((resolve) => (answer = resolve)));
    const hass = fixtureHass();
    const card = await mount(hass);
    await selectFirstRoom(card);
    const picked = picker(card).picked;
    await chooseFirstRobot(card);
    if (picked)
      picker(card).dispatchEvent(
        new RobotChosenEvent({ item: picked.item, vacuumEntityId: picked.candidates[0]?.vacuumEntityId ?? "" }),
      );
    await flush(card);
    answer(true);
    await flush(card);
    expect(show).toHaveBeenCalledTimes(1);
    expect(hass.calls).toHaveLength(1);
  });

  it("falls back to its own dialog, then sends on confirm and gives the focus back to the room", async () => {
    const hass = fixtureHass();
    const card = await mount(hass);
    const { opener } = await selectFirstRoom(card);
    await chooseFirstRobot(card);
    await flush(card);
    expect(dialogOf(ownDialog(card)).open).toBe(true);
    expect(titleOf(ownDialog(card))).toMatch(/^Send Robot (One|Two) to /);
    expect(hass.calls).toEqual([]);
    buttonNamed(ownDialog(card), "Start").click();
    await flush(card);
    expect(hass.calls).toHaveLength(1);
    expect(deepActiveElement()).toBe(opener);
  });

  it("says the robot may have started when the call fails in a way that cannot tell", async () => {
    standardConfirmation(true);
    const hass = fixtureHass();
    hass.behaviour = { kind: "reject", value: { code: "home_assistant_error", message: "Boom" } };
    const card = await mount(hass);
    await selectFirstRoom(card);
    await chooseFirstRobot(card);
    await flush(card);
    expect(hass.calls).toHaveLength(1);
    expect(statusText(card)).toMatch(/^Robot (One|Two) may have started\. Check it before trying again\.$/);
  });

  it("opens no dialog and says why when the robot can no longer start", async () => {
    const show = standardConfirmation(true);
    const hass = fixtureHass();
    const card = await mount(hass);
    const { item } = await selectFirstRoom(card);
    const robot = picker(card).picked?.candidates.find((c) => c.choice.kind !== "not_startable");
    if (!robot) throw new Error("no startable robot");
    const states = roombaPlusStates();
    states[robot.vacuumEntityId] = { ...Object(states[robot.vacuumEntityId]), state: "unavailable" };
    card.hass = nextHass(hass, { states });
    picker(card).dispatchEvent(new RobotChosenEvent({ item, vacuumEntityId: robot.vacuumEntityId }));
    await flush(card);
    expect(show).not.toHaveBeenCalled();
    expect(hass.calls).toEqual([]);
    expect(statusText(card)).toMatch(/cannot start this clean now\.\s*Check that the robot is on/);
  });

  it("in the editor preview, opens no dialog, sends nothing and says starting is off", async () => {
    const show = standardConfirmation(true);
    const hass = hassAs(false, "fr");
    const card = await mount(hass);
    card.preview = true;
    await selectFirstRoom(card);
    await chooseFirstRobot(card);
    await flush(card);
    expect(show).not.toHaveBeenCalled();
    expect(dialogOf(ownDialog(card)).open).toBe(false);
    expect(hass.calls).toEqual([]);
    expect(statusText(card)).toBe("Le lancement est désactivé dans l'aperçu de l'éditeur.");
  });

  it("keeps the last notice when another room is selected, so the plans do not move under the finger", async () => {
    standardConfirmation(true);
    const card = await mount(fixtureHass());
    await selectFirstRoom(card);
    await chooseFirstRobot(card);
    await flush(card);
    const shown = statusText(card);
    expect(shown).not.toBe("");
    await selectFirstRoom(card);
    expect(statusText(card)).toBe(shown);
  });

  it("asks again when a robot is chosen after a cancel", async () => {
    const show = standardConfirmation(false);
    const card = await mount(fixtureHass());
    await selectFirstRoom(card);
    await chooseFirstRobot(card);
    await flush(card);
    await selectFirstRoom(card);
    await chooseFirstRobot(card);
    await flush(card);
    expect(show).toHaveBeenCalledTimes(2);
  });

  it("drops held Enter and Space repeats while the question is open, and only then", async () => {
    let answer: (confirmed: boolean) => void = () => undefined;
    standardConfirmation(() => new Promise<boolean>((resolve) => (answer = resolve)));
    const card = await mount(fixtureHass());
    await selectFirstRoom(card);
    await chooseFirstRobot(card);
    await flush(card);
    const outside = document.createElement("button");
    document.body.append(outside);
    const press = (key: string, repeat: boolean): boolean => {
      const event = new KeyboardEvent("keydown", { key, repeat, bubbles: true, cancelable: true, composed: true });
      outside.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect([press("Enter", true), press(" ", true), press("Enter", false), press("a", true)]).toEqual([
      true,
      true,
      false,
      false,
    ]);
    answer(false);
    await flush(card);
    expect(press("Enter", true)).toBe(false);
  });

  it.each([
    ["the robot can no longer start", false],
    ["the card is in the editor preview", true],
  ])("asks again on the next choice, and holds no key, after %s", async (_case, preview) => {
    const show = standardConfirmation(false);
    const hass = fixtureHass();
    const card = await mount(hass);
    card.preview = preview;
    const { item } = await selectFirstRoom(card);
    const robot = picker(card).picked?.candidates.find((c) => c.choice.kind !== "not_startable");
    if (!robot) throw new Error("no startable robot");
    const states = roombaPlusStates();
    if (!preview) {
      states[robot.vacuumEntityId] = { ...Object(states[robot.vacuumEntityId]), state: "unavailable" };
      card.hass = nextHass(hass, { states });
    }
    picker(card).dispatchEvent(new RobotChosenEvent({ item, vacuumEntityId: robot.vacuumEntityId }));
    await flush(card);
    expect(show).not.toHaveBeenCalled();
    expect(repeatPrevented()).toBe(false);
    card.preview = false;
    card.hass = nextHass(hass, { states: roombaPlusStates() });
    await flush(card);
    await selectFirstRoom(card);
    await chooseFirstRobot(card);
    await flush(card);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it("releases its lock and key hold when it leaves the page with a question that never settles", async () => {
    const show = standardConfirmation(() => new Promise<boolean>(() => undefined));
    const card = await mount(fixtureHass());
    await selectFirstRoom(card);
    await chooseFirstRobot(card);
    await flush(card);
    expect(show).toHaveBeenCalledTimes(1);
    expect(repeatPrevented()).toBe(true);
    card.remove();
    expect(repeatPrevented()).toBe(false);
    document.body.append(card);
    await settle(card);
    await selectFirstRoom(card);
    await chooseFirstRobot(card);
    await flush(card);
    expect(show).toHaveBeenCalledTimes(2);
  });

  it("once confirmed, gives the focus back and says it is sending before the call ends; the robot stays busy", async () => {
    const show = standardConfirmation(true);
    const hass = fixtureHass();
    hass.callService = (...args) => {
      hass.calls.push(args);
      return new Promise(() => undefined);
    };
    const card = await mount(hass);
    const { opener } = await selectFirstRoom(card);
    const robot = await chooseFirstRobot(card);
    await flush(card);
    expect(deepActiveElement()).toBe(opener);
    expect(statusText(card)).toMatch(/^Sending the start to Robot (One|Two)…$/);
    await selectFirstRoom(card);
    picker(card).dispatchEvent(
      new RobotChosenEvent({ item: picker(card).picked?.item ?? fail(), vacuumEntityId: robot }),
    );
    await flush(card);
    expect(show).toHaveBeenCalledTimes(2);
    expect(hass.calls).toHaveLength(1);
    expect(statusText(card)).toMatch(/^Nothing was sent: a start is already being sent to Robot (One|Two)\.$/);
  });

  it("puts no entity, map, area or segment id in the question", async () => {
    const show = standardConfirmation(true);
    const hass = fixtureHass();
    const card = await mount(hass);
    await selectFirstRoom(card);
    await chooseFirstRobot(card);
    await flush(card);
    const asked = JSON.stringify(show.mock.calls[0]?.[1]);
    expect(asked).not.toMatch(/vacuum\.|image\.|select\.|sensor\.|https?:|token/);
    const sent = JSON.stringify(hass.calls[0]).match(/[A-Za-z0-9_.-]{4,}/g) ?? [];
    expect(sent.length).toBeGreaterThan(0);
    for (const id of sent.filter((value) => /[0-9_.]/.test(value))) expect(asked).not.toContain(id);
  });
});
