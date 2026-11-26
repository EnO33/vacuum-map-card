// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { expectNoConsoleOutput } from "../../test/helpers/no-console";
import { img, layer, loaded, mountPicture } from "../../test/helpers/plan-picture";
import { pixelPlan, pixelSquare } from "../../test/helpers/rooms-snapshot";
import { stylesText } from "../../test/helpers/shadow";
import type { ItemRef } from "../app/robots-for-item/robots-for-item";
import { deepActiveElement } from "./focus";
import { PLAN_PICTURE_ELEMENT, PlanPicture } from "./plan-picture";
import { defineOnce } from "./register";
import { ROOM_SELECTED_EVENT } from "./room-selected";

const IMAGE = "image.robot_rooms_map";

// top-left    top-right
// bottom-left bottom-right   (100 px rooms on a 600 px picture), plus a 10 px room far right.
const grid = pixelPlan([
  pixelSquare("bottom-right", 300, 300, 100),
  pixelSquare("top-left", 0, 0, 100),
  pixelSquare("bottom-left", 0, 300, 100),
  pixelSquare("top-right", 300, 0, 100),
  pixelSquare("tiny", 550, 150, 10),
]);

expectNoConsoleOutput();

beforeAll(() => {
  defineOnce(customElements, PLAN_PICTURE_ELEMENT, PlanPicture);
});

afterEach(() => {
  document.body.replaceChildren();
});

async function mounted(): Promise<PlanPicture> {
  const element = await mountPicture({
    src: "https://ha.example.invalid/p.png",
    alt: "Plan",
    locale: "en",
    rooms: grid,
    imageEntityId: IMAGE,
    label: "Ground floor",
  });
  loaded(img(element), 600, 600);
  await element.updateComplete;
  return element;
}

function rooms(element: PlanPicture): SVGElement[] {
  return [...layer(element).querySelectorAll(".room")].filter((r) => r instanceof SVGElement);
}

function room(element: PlanPicture, name: string): SVGElement {
  const found = rooms(element).find((r) => r.getAttribute("aria-label") === name);
  if (!found) throw new Error(`no room ${name}`);
  return found;
}

function selections(element: PlanPicture): ItemRef[] {
  const seen: ItemRef[] = [];
  element.addEventListener(ROOM_SELECTED_EVENT, (event) => {
    if (event instanceof CustomEvent) seen.push(event.detail);
  });
  return seen;
}

function press(target: Element, key: string, init: KeyboardEventInit = {}, type = "keydown"): KeyboardEvent {
  const event = new KeyboardEvent(type, { key, bubbles: true, composed: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

async function focusRoom(element: PlanPicture, name: string): Promise<SVGElement> {
  const target = room(element, name);
  target.focus();
  await element.updateComplete;
  return target;
}

function focusedName(): string | null | undefined {
  return deepActiveElement()?.getAttribute("aria-label");
}

/** The rooms layer is drawn at half the picture's natural size. */
function halfSize(element: PlanPicture): void {
  vi.spyOn(layer(element), "getBoundingClientRect").mockReturnValue(new DOMRect(10, 20, 300, 300));
}

function tap(element: PlanPicture, clientX: number, clientY: number): void {
  const init = { clientX, clientY, detail: 1, bubbles: true, composed: true };
  layer(element).dispatchEvent(new MouseEvent("click", init));
}

describe("PlanPicture rooms as controls", () => {
  it("makes each drawn room a button named after it, in reading order, with labels hidden from assistive tech", async () => {
    const element = await mounted();
    expect(rooms(element).map((r) => [r.getAttribute("role"), r.getAttribute("aria-label")])).toEqual([
      ["button", "top-left"],
      ["button", "top-right"],
      ["button", "tiny"],
      ["button", "bottom-left"],
      ["button", "bottom-right"],
    ]);
    expect(layer(element).getAttribute("role")).toBe("group");
    expect(layer(element).getAttribute("aria-label")).toBe("Rooms, Ground floor");
    expect(layer(element, "labels").getAttribute("aria-hidden")).toBe("true");
  });

  it("gives the plan one tab stop: the first room, then the last focused one", async () => {
    const element = await mounted();
    const stops = () => rooms(element).filter((r) => r.getAttribute("tabindex") === "0");
    expect(stops().map((r) => r.getAttribute("aria-label"))).toEqual(["top-left"]);
    expect(rooms(element).filter((r) => r.getAttribute("tabindex") === "-1")).toHaveLength(4);
    await focusRoom(element, "bottom-right");
    expect(stops().map((r) => r.getAttribute("aria-label"))).toEqual(["bottom-right"]);
  });

  it("draws the focus ring on the tab stop only, the one room that can hold the focus", async () => {
    const element = await mounted();
    const ringed = () =>
      rooms(element)
        .filter((r) => r.querySelector(".ring"))
        .map((r) => r.getAttribute("aria-label"));
    expect(ringed()).toEqual(["top-left"]);
    expect(room(element, "top-left").querySelectorAll(".ring")).toHaveLength(3);
    await focusRoom(element, "tiny");
    expect(ringed()).toEqual(["tiny"]);
  });

  it("moves the focus with the arrow keys, and never out of the plan", async () => {
    const element = await mounted();
    const start = await focusRoom(element, "top-left");
    const event = press(start, "ArrowDown");
    expect(event.defaultPrevented).toBe(true);
    expect(focusedName()).toBe("bottom-left");
    press(room(element, "bottom-left"), "ArrowRight");
    expect(focusedName()).toBe("bottom-right");
    press(room(element, "bottom-right"), "ArrowUp");
    expect(focusedName()).toBe("top-right");
    press(room(element, "top-right"), "ArrowLeft");
    expect(focusedName()).toBe("top-left");
    const edge = press(room(element, "top-left"), "ArrowUp");
    expect(edge.defaultPrevented).toBe(true);
    expect(focusedName()).toBe("top-left");
  });

  it("steps through every room in reading order with Right, back with Left, and stops at the ends", async () => {
    const element = await mounted();
    await focusRoom(element, "top-left");
    const visited = ["top-left"];
    for (let step = 0; step < 5; step += 1) {
      press(room(element, visited.at(-1) ?? ""), "ArrowRight");
      visited.push(focusedName() ?? "");
    }
    expect(visited).toEqual(["top-left", "top-right", "tiny", "bottom-left", "bottom-right", "bottom-right"]);
    press(room(element, "tiny"), "ArrowLeft");
    expect(focusedName()).toBe("top-right");
    press(room(element, "top-left"), "ArrowLeft");
    expect(focusedName()).toBe("top-left");
  });

  it("goes to the first and last room in reading order with Home and End", async () => {
    const element = await mounted();
    await focusRoom(element, "tiny");
    press(room(element, "tiny"), "End");
    expect(focusedName()).toBe("bottom-right");
    press(room(element, "bottom-right"), "Home");
    expect(focusedName()).toBe("top-left");
  });

  it("leaves keys with a modifier and other keys to the browser", async () => {
    const element = await mounted();
    const start = await focusRoom(element, "top-left");
    expect(press(start, "ArrowDown", { altKey: true }).defaultPrevented).toBe(false);
    expect(press(start, "Tab").defaultPrevented).toBe(false);
    expect(focusedName()).toBe("top-left");
  });

  it("selects the focused room with Enter, once while the key repeats", async () => {
    const element = await mounted();
    const seen = selections(element);
    const target = await focusRoom(element, "bottom-left");
    expect(press(target, "Enter").defaultPrevented).toBe(true);
    expect(press(target, "Enter", { repeat: true }).defaultPrevented).toBe(true);
    expect(seen).toEqual([{ kind: "room", imageEntityId: IMAGE, regionId: "bottom-left" }]);
  });

  it("selects the focused room with Space when the key comes up, as a button does", async () => {
    const element = await mounted();
    const seen = selections(element);
    const target = await focusRoom(element, "bottom-left");
    expect(press(target, " ").defaultPrevented).toBe(true);
    expect(seen).toEqual([]);
    press(target, " ", {}, "keyup");
    press(target, " ", { ctrlKey: true }, "keyup");
    press(target, "Enter", {}, "keyup");
    expect(seen).toEqual([{ kind: "room", imageEntityId: IMAGE, regionId: "bottom-left" }]);
  });

  it("acts on the room the key comes from, the one a screen reader announced", async () => {
    const element = await mounted();
    const seen = selections(element);
    await focusRoom(element, "top-left");
    press(room(element, "bottom-right"), "Enter");
    expect(seen.map((s) => s.kind === "room" && s.regionId)).toEqual(["bottom-right"]);
  });

  it("selects the room a screen reader clicks, whatever the click's coordinates", async () => {
    const element = await mounted();
    const seen = selections(element);
    halfSize(element);
    room(element, "tiny").dispatchEvent(new MouseEvent("click", { detail: 0, bubbles: true, composed: true }));
    expect(seen.map((s) => s.kind === "room" && s.regionId)).toEqual(["tiny"]);
    expect(focusedName()).toBe("tiny");
  });

  it("keeps the selection event inside the card's shadow tree", async () => {
    const element = await mounted();
    let event: Event | undefined;
    element.addEventListener(ROOM_SELECTED_EVENT, (e) => {
      event = e;
    });
    press(await focusRoom(element, "top-left"), "Enter");
    expect(event?.bubbles).toBe(true);
    expect(event?.composed).toBe(false);
  });

  it("selects the room under a tap, mapped from the drawn size to the picture's pixels", async () => {
    const element = await mounted();
    const seen = selections(element);
    halfSize(element);
    tap(element, 10 + 175, 20 + 175);
    expect(seen.map((s) => s.kind === "room" && s.regionId)).toEqual(["bottom-right"]);
    expect(focusedName()).toBe("bottom-right");
  });

  it("selects a room smaller than a finger from a tap within 22 px of its middle", async () => {
    const element = await mounted();
    const seen = selections(element);
    halfSize(element);
    // The tiny room's middle (555, 155) is drawn at (277.5, 77.5); 20 px left of it on screen is outside the room.
    tap(element, 10 + 257.5, 20 + 77.5);
    expect(seen.map((s) => s.kind === "room" && s.regionId)).toEqual(["tiny"]);
  });

  it("does nothing on a tap outside every room, or before the layer has a size", async () => {
    const element = await mounted();
    const seen = selections(element);
    tap(element, 100, 100);
    halfSize(element);
    tap(element, 10 + 100, 20 + 100);
    expect(seen).toEqual([]);
  });

  it("marks the selected room", async () => {
    const element = await mounted();
    element.selected = "top-right";
    await element.updateComplete;
    expect(
      rooms(element)
        .filter((r) => r.classList.contains("selected"))
        .map((r) => r.getAttribute("aria-label")),
    ).toEqual(["top-right"]);
  });

  it("shows hover and focus with a fill and the accent stroke, focus with a two-tone ring, without motion when reduced", () => {
    const rules = stylesText(PlanPicture);
    expect(rules).toMatch(/\.room:focus-visible \.shape\s*\{[^}]*stroke:\s*var\(--primary-color/);
    expect(rules).toMatch(
      /@media \(hover: hover\)\s*\{\s*\.room:hover \.shape\s*\{[^}]*stroke:\s*var\(--primary-color/,
    );
    expect(rules).toMatch(/@media \(forced-colors: active\)\s*\{[^@]*\.ring-focus\s*\{\s*stroke:\s*Highlight/);
    expect(rules).toMatch(/\.room:focus-visible \.ring\s*\{[^}]*display:\s*inline/);
    expect(rules).toMatch(/\.ring-focus\s*\{[^}]*stroke:\s*var\(--ha-color-focus, var\(--primary-color/);
    expect(rules).toMatch(/\.ring-outer\s*\{[^}]*stroke:\s*var\(--primary-text-color/);
    expect(rules).toMatch(/\.ring-halo\s*\{[^}]*stroke:\s*var\(--card-background-color/);
    expect(rules).toMatch(/transition:[^;]*var\(--ha-animation-duration-fast/);
    expect(rules).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.room \.shape\s*\{\s*transition:\s*none/);
  });
});
