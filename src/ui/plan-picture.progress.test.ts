// @vitest-environment happy-dom
import { html, render } from "lit";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { expectNoConsoleOutput } from "../../test/helpers/no-console";
import { img, layer, loaded, mountPicture } from "../../test/helpers/plan-picture";
import { planOf, snapshotFixtures, snapshotOf, squareRoom } from "../../test/helpers/rooms-snapshot";
import { stylesText } from "../../test/helpers/shadow";
import type { ProgressEntry } from "../app/progress/progress-tracker";
import type { ProgressPhase } from "../domain/clean/progress";
import { roomList } from "./plan-content";
import { PLAN_PICTURE_ELEMENT, PlanPicture } from "./plan-picture";
import { progressTone } from "./progress-marks";
import { defineOnce } from "./register";

const IMAGE = "image.robot_one_rooms_map";
const NAMES = new Map([
  ["vacuum.one", "Robot <one>"],
  ["vacuum.two", "Robot two"],
]);
const base = snapshotOf(snapshotFixtures.vacuumAligned);

expectNoConsoleOutput();

beforeAll(() => {
  defineOnce(customElements, PLAN_PICTURE_ELEMENT, PlanPicture);
});

afterEach(() => {
  document.body.replaceChildren();
});

function onRoom(regionId: string, phase: ProgressPhase, extra: Partial<ProgressEntry> = {}): ProgressEntry {
  return {
    vacuumEntityId: "vacuum.one",
    item: { kind: "room", imageEntityId: IMAGE, regionId },
    phase,
    statusUnknown: false,
    ...extra,
  };
}

async function drawn(progress: readonly ProgressEntry[]): Promise<PlanPicture> {
  const rooms = planOf({ ...base, rooms: [{ ...squareRoom("1"), name: "<b>Hall</b>" }] });
  const element = await mountPicture({
    src: "x",
    locale: "en",
    rooms,
    imageEntityId: IMAGE,
    progress,
    robotNames: NAMES,
  });
  loaded(img(element), 600, 600);
  await element.updateComplete;
  return element;
}

function room(element: PlanPicture): Element | null {
  return layer(element).querySelector(".room");
}

describe("PlanPicture progress", () => {
  it("draws nothing extra on a room no robot was sent to", async () => {
    const element = await drawn([]);
    expect(room(element)?.getAttribute("class")).toBe("room");
    expect(room(element)?.getAttribute("aria-label")).toBe("<b>Hall</b>");
    expect(layer(element, "labels").querySelector(".badge")).toBeNull();
  });

  it("fills a cleaning room with its colour and shows the icon and the label: not colour alone", async () => {
    const element = await drawn([onRoom("1", "cleaning")]);
    expect(room(element)?.getAttribute("class")).toBe("room filled tone-cleaning");
    expect(room(element)?.getAttribute("aria-label")).toBe("<b>Hall</b>, Robot <one>: Cleaning");
    const badge = layer(element, "labels").querySelector(".badge");
    expect(badge?.getAttribute("class")).toBe("badge tone-cleaning");
    expect(badge?.querySelector(".badge-icon circle")).not.toBeNull();
    expect(badge?.querySelector(".badge-label")?.textContent).toBe("Cleaning");
    expect(layer(element, "labels").querySelector("b")).toBeNull();
  });

  it("draws a phase without a state colour with its icon and label, and no fill", async () => {
    const element = await drawn([onRoom("1", "starting")]);
    expect(room(element)?.getAttribute("class")).toBe("room");
    expect(layer(element, "labels").querySelector(".badge-label")?.textContent).toBe("Starting");
  });

  it("names every robot sent to the room, and draws the most urgent", async () => {
    const element = await drawn([onRoom("1", "done"), onRoom("1", "failed", { vacuumEntityId: "vacuum.two" })]);
    expect(room(element)?.getAttribute("aria-label")).toBe("<b>Hall</b>, Robot <one>: Done, Robot two: Failed");
    expect(room(element)?.getAttribute("class")).toBe("room filled tone-failed");
    expect(layer(element, "labels").querySelector(".badge-label")?.textContent).toBe("Failed");
  });

  it("draws an unknown status before work under way", async () => {
    const element = await drawn([
      onRoom("1", "cleaning"),
      onRoom("1", "cleaning", { vacuumEntityId: "vacuum.two", statusUnknown: true }),
    ]);
    expect(room(element)?.getAttribute("class")).toBe("room filled tone-unknown");
  });

  it("does not update for a new array of the same entries", async () => {
    const entries = [onRoom("1", "cleaning")];
    const element = await drawn(entries);
    const update = element.updateComplete;
    element.progress = [...entries];
    expect(element.updateComplete).toBe(update);
    element.progress = [onRoom("1", "done")];
    expect(element.updateComplete).not.toBe(update);
  });

  it("ignores progress on another room or on an area", async () => {
    const element = await drawn([
      onRoom("2", "cleaning"),
      { ...onRoom("1", "cleaning"), item: { kind: "area", imageEntityId: IMAGE, areaId: "1" } },
    ]);
    expect(room(element)?.getAttribute("class")).toBe("room");
  });

  it("colours each tone from the theme, with no animation", () => {
    const styles = stylesText(PlanPicture);
    expect(styles).toContain(
      "--progress-color: var(--state-vacuum-cleaning-color, var(--state-vacuum-active-color, var(--state-active-color)))",
    );
    expect(styles).toContain("--progress-color: var(--success-color)");
    expect(styles).toContain("--progress-color: var(--state-unavailable-color)");
    expect(styles).toMatch(/\.room\.filled \.shape \{[^}]*fill: var\(--progress-color\)/);
    expect(styles).not.toMatch(/animation:|@keyframes/);
  });
});

describe("progressTone", () => {
  it.each<[ProgressPhase, boolean, string]>([
    ["cleaning", false, "cleaning"],
    ["paused", false, "paused"],
    ["failed", false, "failed"],
    ["done", false, "done"],
    ["sending", false, "none"],
    ["may_have_started", false, "none"],
    ["cleaning", true, "unknown"],
  ])("gives %s (status unknown: %s) the %s tone", (phase, statusUnknown, tone) => {
    expect(progressTone(onRoom("1", phase, { statusUnknown }))).toBe(tone);
  });
});

describe("roomList progress", () => {
  const plan = {
    imageEntityId: IMAGE,
    content: {
      kind: "areas",
      items: [
        { areaId: "hall", name: "<b>Hall</b>" },
        { areaId: "kitchen", name: "Kitchen" },
      ],
    },
  } as const;

  function buttons(progress: readonly ProgressEntry[]): HTMLButtonElement[] {
    const host = document.createElement("div");
    const robotName = (id: string) => NAMES.get(id) ?? id;
    render(html`${roomList(plan, "Ground floor", progress, { locale: "en", robotName })}`, host);
    return [...host.querySelectorAll("button")];
  }

  it("shows an area's phase on its button, by colour, icon and label, in its accessible name", () => {
    const area = { ...onRoom("x", "paused"), item: { kind: "area" as const, imageEntityId: IMAGE, areaId: "hall" } };
    const [hall, kitchen] = buttons([area]);
    expect(hall?.className).toBe("outlined-button filled tone-paused");
    expect(hall?.getAttribute("aria-label")).toBe("<b>Hall</b>, Robot <one>: Paused");
    expect(hall?.querySelector(".room-badge svg")).not.toBeNull();
    expect(hall?.querySelector(".room-badge")?.textContent?.trim()).toBe("Paused");
    expect(hall?.querySelector("b")).toBeNull();
    expect(kitchen?.className).toBe("outlined-button");
    expect(kitchen?.hasAttribute("aria-label")).toBe(false);
  });
});
