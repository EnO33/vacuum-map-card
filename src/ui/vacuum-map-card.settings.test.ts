// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import type { TestCard } from "../../test/helpers/card";
import {
  firstPlan,
  hassAs,
  mount,
  collapsedText as text,
  useTestCard,
  withFirstFloorPlan,
} from "../../test/helpers/card";
import { expectNoConsoleOutput } from "../../test/helpers/no-console";
import { stylesText } from "../../test/helpers/shadow";
import { MORE_INFO_EVENT } from "./settings-button";
import { VacuumMapCard } from "./vacuum-map-card";

useTestCard();
expectNoConsoleOutput();

const OFF_PLAN = "image.off_plan";
const ROBOT = "vacuum.mapped_bot";

function settingsButtons(card: TestCard): HTMLButtonElement[] {
  return [...(firstPlan(card)?.querySelectorAll("button.settings-button") ?? [])].filter(
    (button) => button instanceof HTMLButtonElement,
  );
}

interface SeenEvent {
  readonly detail: unknown;
  /** Whether the element it was fired from was in the document. */
  readonly connected: boolean;
  readonly bubbles: boolean;
  readonly composed: boolean;
}

let listening = new AbortController();
afterEach(() => {
  listening.abort();
  listening = new AbortController();
});

/** Every {@link MORE_INFO_EVENT} that reaches the window, as Home Assistant's app root would receive it. */
function moreInfoEvents(): SeenEvent[] {
  const seen: SeenEvent[] = [];
  window.addEventListener(
    MORE_INFO_EVENT,
    (event) => {
      const [target] = event.composedPath();
      seen.push({
        detail: event instanceof CustomEvent ? event.detail : undefined,
        connected: target instanceof Node && target.isConnected,
        bubbles: event.bubbles,
        composed: event.composed,
      });
    },
    { signal: listening.signal },
  );
  return seen;
}

function settingsOf(entityId: string): SeenEvent {
  return { detail: { entityId, view: "settings" }, connected: true, bubbles: true, composed: true };
}

describe("VacuumMapCard disabled floor plan", () => {
  it("says the plan is turned off and gives every user the steps to enable it, in place of its picture", async () => {
    withFirstFloorPlan({ pictureState: "disabled", imageEntityId: OFF_PLAN });
    const card = await mount(hassAs(false));
    const message = firstPlan(card)?.querySelector(".plan-message");
    expect(firstPlan(card)?.querySelector("vmc-plan-picture")).toBeNull();
    expect(text(message?.querySelector("p"))).toBe("This floor plan is turned off in Home Assistant.");
    expect(text(message)).toContain("To show it, ask an administrator to enable its entity:");
    expect([...(message?.querySelectorAll("ol > li") ?? [])].map(text)).toStrictEqual([
      "Go to Settings › Devices & services › Entities and set the Status filter to Disabled.",
      `Search for ${OFF_PLAN}, open it, then open its Settings.`,
      "Under « This entity is disabled. », select Enable.",
    ]);
    expect(settingsButtons(card)).toStrictEqual([]);
  });

  it("speaks Home Assistant's French wording", async () => {
    withFirstFloorPlan({ pictureState: "disabled", imageEntityId: OFF_PLAN });
    const card = await mount(hassAs(true, "fr"));
    const message = firstPlan(card)?.querySelector(".plan-message");
    expect(text(message?.querySelector("p"))).toBe("Ce plan est désactivé dans Home Assistant.");
    expect([...(message?.querySelectorAll("ol > li") ?? [])].map(text)).toStrictEqual([
      "Dans Paramètres › Appareils et services › Entités, réglez le filtre État sur Désactivée.",
      `Recherchez ${OFF_PLAN}, ouvrez-la, puis ouvrez ses Paramètres.`,
      "Sous « Cette entité est désactivée. », choisissez Activer.",
    ]);
    expect(settingsButtons(card).map(text)).toStrictEqual(["Ouvrir les paramètres de l'entité"]);
  });

  it("gives an administrator a button that opens the floor plan's settings", async () => {
    withFirstFloorPlan({ pictureState: "disabled", imageEntityId: OFF_PLAN });
    const card = await mount(hassAs(true));
    expect(text(firstPlan(card)?.querySelector(".plan-message"))).toContain("Or, in Home Assistant:");
    const events = moreInfoEvents();
    const [button, ...others] = settingsButtons(card);
    expect(others).toStrictEqual([]);
    expect(text(button)).toBe("Open entity settings");
    expect(button?.getAttribute("aria-label")).toBe("Open entity settings, Ground floor");
    expect(button?.getAttribute("type")).toBe("button");
    expect(button?.classList.contains("outlined-button")).toBe(true);
    expect(button?.compareDocumentPosition(firstPlan(card)?.querySelector("ol") ?? button)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    button?.click();
    expect(events).toStrictEqual([settingsOf(OFF_PLAN)]);
  });
});

describe("VacuumMapCard vacuum settings for the segment mapping", () => {
  it("gives an administrator a button in the note that opens the vacuum's settings", async () => {
    withFirstFloorPlan({ robot: ROBOT, content: { kind: "picture_only", reason: "mapping_absent" } });
    const card = await mount(hassAs(true));
    const events = moreInfoEvents();
    const [button, ...others] = settingsButtons(card);
    expect(others).toStrictEqual([]);
    expect(text(button)).toBe("Open vacuum settings");
    expect(button?.getAttribute("aria-label")).toBe("Open vacuum settings, Ground floor");
    expect(button?.classList.contains("outlined-button")).toBe(true);
    expect(button?.closest('[role="note"]')).not.toBeNull();
    button?.click();
    expect(events).toStrictEqual([settingsOf(ROBOT)]);
  });

  it("renders no button for a non-administrator, nor when the mapping is not the fix", async () => {
    withFirstFloorPlan({ content: { kind: "picture_only", reason: "mapping_absent" } });
    expect(settingsButtons(await mount(hassAs(false)))).toStrictEqual([]);
    withFirstFloorPlan({ content: { kind: "picture_only", reason: "no_clean_area" } });
    expect(settingsButtons(await mount(hassAs(true)))).toStrictEqual([]);
  });
});

describe("VacuumMapCard settings buttons", () => {
  it("are told apart and never write to Home Assistant", async () => {
    withFirstFloorPlan({ pictureState: "disabled", content: { kind: "picture_only", reason: "mapping_absent" } });
    const hass = hassAs(true);
    const card = await mount(hass);
    const before = hass.wsCalls.length;
    const buttons = settingsButtons(card);
    expect(buttons.map(text)).toStrictEqual(["Open entity settings", "Open vacuum settings"]);
    for (const button of buttons) button.click();
    await card.updateComplete;
    expect(hass.wsCalls.slice(before)).toStrictEqual([]);
    expect(hass.calls).toStrictEqual([]);
  });
});

describe("VacuumMapCard disabled plan styles", () => {
  it("wraps a long entity id inside the box and spaces a note's button from its lines", () => {
    const rules = stylesText(VacuumMapCard);
    expect(rules).toMatch(/\.disabled-plan\s*\{[^}]*overflow-wrap:\s*anywhere/);
    expect(rules).toMatch(/\.notice \.notice-action\s*\{[^}]*margin-block:\s*var\(--ha-space-2/);
  });
});
