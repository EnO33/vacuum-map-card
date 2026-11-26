// @vitest-environment happy-dom
import { html, render } from "lit";
import { afterEach, describe, expect, it } from "vitest";
import type { ProgressEntry } from "../app/progress/progress-tracker";
import { roomList } from "./plan-content";
import { dismissFrom, focusItem, type ProgressContext, ProgressDismissedEvent, progressList } from "./progress-list";

const IMAGE = "image.plan";

function entry(vacuumEntityId: string, phase: ProgressEntry["phase"] = "done"): ProgressEntry {
  return { vacuumEntityId, item: { kind: "area", imageEntityId: IMAGE, areaId: "hall" }, phase, statusUnknown: false };
}

const context: ProgressContext = {
  locale: "en",
  isAdmin: false,
  robotName: (id) => (id === "vacuum.one" ? "Robot one" : "Robot two"),
  itemName: () => undefined,
};

function shown(entries: readonly ProgressEntry[]): HTMLElement {
  const host = document.createElement("div");
  document.body.append(host);
  render(html`${progressList(entries, "Cleaning progress, Ground floor", context)}`, host);
  return host;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("progressList", () => {
  it("shows nothing without entries", () => {
    expect(shown([]).children).toHaveLength(0);
  });

  it("speaks of a room the plans no longer have, and fires the robot's dismiss inside the card", () => {
    const host = shown([entry("vacuum.one")]);
    expect(host.querySelector("ul")?.getAttribute("aria-label")).toBe("Cleaning progress, Ground floor");
    expect(host.querySelector("p")?.textContent).toBe("Robot one finished cleaning a room no longer on the plans.");
    const fired: ProgressDismissedEvent[] = [];
    host.addEventListener(ProgressDismissedEvent.type, (event) => {
      if (event instanceof ProgressDismissedEvent) fired.push(event);
    });
    host.querySelector("button")?.click();
    expect(fired.map((event) => [event.vacuumEntityId, event.composed, event.bubbles])).toEqual([
      ["vacuum.one", false, true],
    ]);
  });
});

describe("dismissFrom", () => {
  it.each([
    [0, "vacuum.two"],
    [1, "vacuum.one"],
  ])("moves the focus from removed button %i to the one in its place, else the one before", async (index, kept) => {
    let entries = [entry("vacuum.one"), entry("vacuum.two")];
    const host = document.createElement("div");
    document.body.append(host);
    const draw = async () => render(html`${progressList(entries, "x", context)}`, host);
    await draw();
    const button = host.querySelectorAll("button")[index] ?? null;
    const toItem: (Element | null)[] = [];
    await dismissFrom(
      button,
      () => {
        entries = entries.filter((_, i) => i !== index);
      },
      draw,
      (plan) => toItem.push(plan),
    );
    expect(document.activeElement?.getAttribute("aria-label")).toContain(
      kept === "vacuum.one" ? "Robot one" : "Robot two",
    );
    expect(toItem).toEqual([]);
  });

  it("gives the focus back to the item on its plan when the list is gone", async () => {
    let entries = [entry("vacuum.one")];
    const plan = document.createElement("div");
    plan.className = "plan";
    document.body.append(plan);
    render(html`${progressList(entries, "x", context)}`, plan);
    const toItem: (Element | null)[] = [];
    await dismissFrom(
      plan.querySelector("button"),
      () => {
        entries = [];
      },
      async () => render(html`${progressList(entries, "x", context)}`, plan),
      (to) => toItem.push(to),
    );
    expect(toItem).toEqual([plan]);
  });
});

describe("roomList progress without a state colour", () => {
  it("shows the label and icon on the button, with no colour", () => {
    const host = document.createElement("div");
    const plan = {
      imageEntityId: IMAGE,
      content: { kind: "areas", items: [{ areaId: "hall", name: "Hall" }] },
    } as const;
    render(html`${roomList(plan, "Ground floor", [entry("vacuum.one", "sending")], context)}`, host);
    const button = host.querySelector("button");
    expect(button?.className).toBe("outlined-button");
    expect(button?.getAttribute("aria-label")).toBe("Hall, Robot one: Sending");
    expect(button?.querySelector(".room-badge")?.textContent?.trim()).toBe("Sending");
  });
});

describe("focusItem", () => {
  const plans = [
    {
      imageEntityId: IMAGE,
      content: {
        kind: "areas",
        items: [
          { areaId: "kitchen", name: "Kitchen" },
          { areaId: "hall", name: "Hall" },
        ],
      },
    },
  ] as const;

  function plan(): HTMLElement {
    const host = document.createElement("div");
    document.body.append(host);
    render(html`${roomList(plans[0], "Ground floor", [], context)}`, host);
    return host;
  }

  it("focuses the area's button in the room list", () => {
    const host = plan();
    expect(focusItem(host, { kind: "area", imageEntityId: IMAGE, areaId: "hall" }, plans)).toBe(true);
    expect(document.activeElement?.textContent?.trim()).toBe("Hall");
  });

  it("focuses nothing for an area or a plan the card no longer shows", () => {
    const host = plan();
    const tries = [
      focusItem(host, { kind: "area", imageEntityId: IMAGE, areaId: "attic" }, plans),
      focusItem(host, { kind: "area", imageEntityId: "image.other", areaId: "hall" }, plans),
      focusItem(null, { kind: "room", imageEntityId: IMAGE, regionId: "1" }, plans),
      focusItem(host, { kind: "room", imageEntityId: IMAGE, regionId: "1" }, plans),
    ];
    expect(tries).toEqual([false, false, false, false]);
    expect(document.activeElement).toBe(document.body);
  });
});
