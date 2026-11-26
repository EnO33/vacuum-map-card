// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { FakeHass } from "../../test/fakes/fake-hass";
import { FakeRoomSource } from "../../test/fakes/fake-room-source";
import { collapsedText } from "../../test/helpers/card";
import { shadowOf, stylesText } from "../../test/helpers/shadow";
import { withRobot } from "../../test/helpers/sources";
import { buildFloorModel } from "../app/floor-model/build-floor-model";
import type { Candidate } from "../app/robots-for-item/choice";
import { type ItemRef, robotsForItem } from "../app/robots-for-item/robots-for-item";
import { defineOnce } from "./register";
import { ROBOT_CHOSEN_EVENT, ROBOT_PICKER_ELEMENT, type RobotChosen, RobotPicker } from "./robot-picker";

const ITEM: ItemRef = { kind: "room", imageEntityId: "image.robot_one_rooms_map", regionId: "1" };
const NAMES = new Map([
  ["vacuum.robot_one", "Robot one"],
  ["vacuum.robot_two", "Robot two"],
]);

const PATH2: Candidate = {
  vacuumEntityId: "vacuum.robot_one",
  action: "vacuum",
  state: "docked",
  choice: {
    kind: "path2",
    regionId: "1",
    ownRoomName: "Kitchen",
    call: { domain: "vacuum", service: "send_command", data: { entity_id: "vacuum.robot_one" } },
  },
};
function path1(roomNames: readonly string[]): Candidate {
  return {
    vacuumEntityId: "vacuum.robot_two",
    action: "mop",
    state: "cleaning",
    choice: { kind: "path1", areaId: "kitchen", roomNames, mapId: "m", segments: [] },
  };
}
const PATH1 = path1(["Kitchen", "Pantry"]);
const REFUSED: Candidate = {
  vacuumEntityId: "vacuum.robot_two",
  action: "mop",
  state: "unavailable",
  choice: { kind: "not_startable", reasons: ["unavailable", "no_room_action"] },
};

async function mount(
  props: Partial<Pick<RobotPicker, "locale" | "itemName" | "candidates" | "robotNames">>,
): Promise<RobotPicker> {
  const element = document.createElement(ROBOT_PICKER_ELEMENT);
  if (!(element instanceof RobotPicker)) throw new Error("not a RobotPicker");
  Object.assign(element, { item: ITEM, itemName: "Kitchen", robotNames: NAMES, ...props });
  document.body.append(element);
  await element.updateComplete;
  return element;
}

const root = (element: RobotPicker) => shadowOf(element);
const rows = (element: RobotPicker) => Array.from(root(element).querySelectorAll(".robots > li"));

function buttonIn(row: Element | undefined, kind: "choose" | "details"): HTMLButtonElement {
  const button = row?.querySelector(`button.${kind}`);
  if (!(button instanceof HTMLButtonElement)) throw new Error(`no ${kind} button`);
  return button;
}

beforeAll(() => {
  defineOnce(customElements, ROBOT_PICKER_ELEMENT, RobotPicker);
});

afterEach(() => {
  document.body.replaceChildren();
});

describe("RobotPicker", () => {
  it("heads the list with the item's name and labels the list with it", async () => {
    const element = await mount({ candidates: [PATH2] });
    const heading = root(element).querySelector("h2");
    expect(collapsedText(heading)).toBe("Kitchen");
    const list = root(element).querySelector("ul");
    expect(list?.getAttribute("aria-labelledby")).toBe(heading?.id);
  });

  it("lists one row per candidate in the given order", async () => {
    const element = await mount({ candidates: [PATH2, PATH1] });
    expect(rows(element).map((row) => collapsedText(row.querySelector(".name")))).toEqual(["Robot one", "Robot two"]);
  });

  it("shows a startable robot as a button with its name, action and state", async () => {
    const element = await mount({ candidates: [PATH2] });
    const button = buttonIn(rows(element)[0], "choose");
    expect(button.type).toBe("button");
    expect(collapsedText(button.querySelector(".name"))).toBe("Robot one");
    expect(collapsedText(button.querySelector(".action"))).toBe("Vacuum");
    expect(collapsedText(button.querySelector(".state"))).toBe("Docked");
    expect(button.querySelector(".dot")?.classList.contains("docked")).toBe(true);
    expect(button.getAttribute("aria-label")).toBeNull();
    expect(collapsedText(button).startsWith("Robot one Vacuum")).toBe(true);
  });

  it("says which rooms a path 1 robot cleans when it cleans several", async () => {
    const element = await mount({ candidates: [PATH1, path1(["One"])] });
    const [several, one] = rows(element);
    expect(collapsedText(several?.querySelector(".cleans"))).toBe("Cleans: Kitchen, Pantry");
    expect(one?.querySelector(".cleans")).toBeNull();
  });

  it("speaks French", async () => {
    const element = await mount({ locale: "fr", candidates: [PATH1, REFUSED] });
    const [path1, refused] = rows(element);
    expect(collapsedText(path1?.querySelector(".action"))).toBe("Laver le sol");
    expect(collapsedText(path1?.querySelector(".state"))).toBe("Nettoyage");
    expect(collapsedText(path1?.querySelector(".cleans"))).toBe("Pièces : Kitchen, Pantry");
    expect(collapsedText(refused?.querySelector(".cannot"))).toBe("Ne peut pas nettoyer cette pièce");
    expect(collapsedText(refused?.querySelector(".reasons li"))).toBe(
      "Vérifiez que le robot est allumé et connecté à Home Assistant.",
    );
  });

  it("shows a robot that cannot start as a disabled group, named by the robot, that says why", async () => {
    const element = await mount({ candidates: [REFUSED] });
    const row = rows(element)[0];
    const group = row?.querySelector('[role="group"]');
    expect(group?.getAttribute("aria-disabled")).toBe("true");
    expect(collapsedText(root(element).getElementById(group?.getAttribute("aria-labelledby") ?? ""))).toBe("Robot two");
    expect(row?.querySelector("button.choose")).toBeNull();
    expect(collapsedText(row?.querySelector(".state"))).toBe("Unavailable");
    expect(collapsedText(row?.querySelector(".cannot"))).toBe("Cannot clean this room");
    expect(Array.from(row?.querySelectorAll(".reasons li") ?? [], collapsedText)).toEqual([
      "Check that the robot is on and connected to Home Assistant.",
      "The robot's integration offers no action to clean this room.",
    ]);
  });

  it("keeps the details button out of the disabled group", async () => {
    const element = await mount({ candidates: [REFUSED] });
    const details = buttonIn(rows(element)[0], "details");
    expect(details.closest('[aria-disabled="true"]')).toBeNull();
    expect(details.title).toBe("Robot details, Robot two");
  });

  it("gives a single reason as a sentence, not a list", async () => {
    const element = await mount({
      candidates: [{ ...REFUSED, choice: { kind: "not_startable", reasons: ["no_state"] } }],
    });
    const row = rows(element)[0];
    expect(row?.querySelector(".reasons ul")).toBeNull();
    expect(collapsedText(row?.querySelector(".reasons p"))).toBe(
      "Home Assistant has no state for this robot: it may be disabled.",
    );
  });

  it("fires robot-chosen with the item and the robot when a startable row is chosen", async () => {
    const element = await mount({ candidates: [PATH2] });
    const events: RobotChosen[] = [];
    element.addEventListener(ROBOT_CHOSEN_EVENT, (event) => {
      if (event instanceof CustomEvent) events.push(event.detail);
    });
    buttonIn(rows(element)[0], "choose").click();
    expect(events).toEqual([{ item: ITEM, vacuumEntityId: "vacuum.robot_one" }]);
  });

  it.each([
    ["a startable", PATH2, "vacuum.robot_one", "Robot one"],
    ["a refused", REFUSED, "vacuum.robot_two", "Robot two"],
  ])("opens %s robot's details from the picker element", async (_kind, candidate, entityId, name) => {
    const element = await mount({ candidates: [candidate] });
    const seen: { detail: unknown; bubbles: boolean; composed: boolean; target: EventTarget | null }[] = [];
    document.body.addEventListener("hass-more-info", (event) => {
      if (event instanceof CustomEvent) {
        seen.push({ detail: event.detail, bubbles: event.bubbles, composed: event.composed, target: event.target });
      }
    });
    const details = buttonIn(rows(element)[0], "details");
    expect(details.getAttribute("aria-label")).toBe(`Robot details, ${name}`);
    details.click();
    expect(seen).toEqual([{ detail: { entityId }, bubbles: true, composed: true, target: element }]);
  });

  it("does not open the details or choose a robot once it has left the page", async () => {
    const element = await mount({ candidates: [PATH2] });
    const row = rows(element)[0];
    let fired = 0;
    element.addEventListener("hass-more-info", () => fired++);
    element.addEventListener(ROBOT_CHOSEN_EVENT, () => fired++);
    element.remove();
    buttonIn(row, "details").click();
    buttonIn(row, "choose").click();
    expect(fired).toBe(0);
  });

  it("puts the focus on the first robot that can start", async () => {
    const element = await mount({ candidates: [REFUSED, PATH2, PATH1] });
    element.focusFirst();
    expect(root(element).activeElement).toBe(buttonIn(rows(element)[1], "choose"));
  });

  it("puts the focus on the heading when no robot can start", async () => {
    const element = await mount({ candidates: [REFUSED] });
    element.focusFirst();
    const heading = root(element).querySelector("h2");
    expect(root(element).activeElement).toBe(heading);
    expect(heading?.getAttribute("tabindex")).toBe("-1");
  });

  it("lists its controls in focus order: each row's choice, then its details", async () => {
    const element = await mount({ candidates: [PATH2, REFUSED] });
    const [first, second] = rows(element);
    expect(element.controls()).toEqual([
      buttonIn(first, "choose"),
      buttonIn(first, "details"),
      buttonIn(second, "details"),
    ]);
  });

  it("says when no robot can clean the room", async () => {
    const en = await mount({ candidates: [] });
    expect(root(en).querySelector("ul")).toBeNull();
    expect(collapsedText(root(en).querySelector(".empty"))).toBe("No robot can clean this room");
    const fr = await mount({ locale: "fr", candidates: [] });
    expect(collapsedText(root(fr).querySelector(".empty"))).toBe("Aucun robot ne peut nettoyer cette pièce");
  });

  it("renders names and unknown states as text, never markup", async () => {
    const element = await mount({
      itemName: "<b>Kitchen</b>",
      robotNames: new Map([["vacuum.robot_one", "<img src=x>"]]),
      candidates: [{ ...PATH2, state: "<i>odd</i>" }],
    });
    expect(collapsedText(root(element).querySelector("h2"))).toBe("<b>Kitchen</b>");
    const row = rows(element)[0];
    expect(collapsedText(row?.querySelector(".name"))).toBe("<img src=x>");
    expect(collapsedText(row?.querySelector(".state"))).toBe("Unknown state");
    expect(root(element).querySelector("b, img, i")).toBeNull();
  });

  it("names a robot by its entity id when it has no name", async () => {
    const element = await mount({ robotNames: new Map(), candidates: [PATH2] });
    expect(collapsedText(rows(element)[0]?.querySelector(".name"))).toBe("vacuum.robot_one");
  });

  it("lists the fixture robots for a shared room with their actions", async () => {
    const hass = new FakeHass({ services: ["vacuum.clean_area"] });
    const source = withRobot(new FakeRoomSource(), "vacuum.robot_two", (robot) => ({
      storedMaps: robot.storedMaps.map((m) => (m.mapId === "MapD_r7T8y9" ? { ...m, ownAreaId: "library" } : m)),
    }));
    const item: ItemRef = { kind: "room", imageEntityId: "image.robot_two_rooms_map", regionId: "1" };
    const candidates = robotsForItem(buildFloorModel(hass, [source]), item, hass, [source]);
    const element = await mount({ candidates, robotNames: new Map() });
    expect(rows(element).map((row) => collapsedText(row.querySelector(".name")))).toEqual([
      "vacuum.robot_two",
      "vacuum.robot_one",
    ]);
    expect(rows(element).map((row) => collapsedText(row.querySelector(".action")))).toEqual(["Mop", "Vacuum"]);
  });

  it("gives every control a 44 px touch target", () => {
    const rules = stylesText(RobotPicker).replace(/\s+/g, " ");
    expect(rules).toMatch(/\.robot \{[^}]*min-height: 44px/);
    expect(rules).toMatch(/\.icon-button \{[^}]*width: 44px;[^}]*height: 44px/);
  });

  it.each([
    ["cleaning", "var(--state-vacuum-cleaning-color, var(--state-vacuum-active-color, var(--state-active-color)))"],
    ["error", "var(--state-vacuum-error-color, var(--state-vacuum-active-color, var(--state-active-color)))"],
    ["docked", "var(--state-vacuum-docked-color, var(--state-vacuum-inactive-color, var(--state-inactive-color)))"],
    ["unknown", "var(--state-unavailable-color)"],
  ])("colours the %s dot with the frontend's chain", (tone, chain) => {
    const rules = stylesText(RobotPicker).replace(/\s+/g, " ");
    const rule = rules.slice(rules.indexOf(`.dot.${tone}`));
    expect(rule.slice(0, rule.indexOf("}"))).toContain(`background: ${chain};`);
  });
});
