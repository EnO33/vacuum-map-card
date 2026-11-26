// Test helper: the card element over injected dependencies (the real adapters on the fake frontend `hass` by default),
// with its adapters' `start` and `stop` and its renders counted. Call `useTestCard()` once per test file.
import { afterEach, beforeAll, beforeEach, expect, vi } from "vitest";
import { type Adapters, createAdapters } from "../../src/adapters/create-adapters";
import type { FrontendHass } from "../../src/adapters/hass/frontend-hass";
import type { FloorModel, Plan } from "../../src/app/floor-model/floor-model";
import { createFloorModelBuilder, type FloorModelBuilder } from "../../src/app/floor-model/memo";
import type { SessionDependencies } from "../../src/ui/card-session";
import { PLAN_PICTURE_ELEMENT, PlanPicture } from "../../src/ui/plan-picture";
import { defineOnce } from "../../src/ui/register";
import { VacuumMapCard } from "../../src/ui/vacuum-map-card";
import type { FakeFrontendHass } from "../fakes/frontend-hass";
import { type AdaptersHarness, adaptersHarness } from "./adapters";
import { shadowOf } from "./shadow";

const TAG = "vacuum-map-card-under-test";
export const LOADING = "Loading floor plans…";

/** What the card under test uses; a test may replace `current` or one of its members before it mounts a card. */
export const injected: { current: SessionDependencies } = { current: countingDependencies() };
export const counts = { created: 0, started: 0, stopped: 0 };

export class TestCard extends VacuumMapCard {
  renders = 0;

  protected override sessionDependencies(): SessionDependencies {
    return injected.current;
  }

  protected override render() {
    this.renders++;
    return super.render();
  }
}

/** The real adapters, with their `start` and `stop` counted, and the real model builder. */
function countingDependencies(): SessionDependencies {
  return {
    createAdapters: (getHass: () => FrontendHass): Adapters => {
      counts.created++;
      const adapters = createAdapters(getHass);
      return {
        ...adapters,
        start: () => {
          counts.started++;
          adapters.start();
        },
        stop: () => {
          counts.stopped++;
          adapters.stop();
        },
      };
    },
    createModelBuilder: createFloorModelBuilder,
  };
}

/** Defines the element, fakes the timers, resets the injected dependencies, and checks no timer is left. */
export function useTestCard(): void {
  beforeAll(() => {
    defineOnce(customElements, TAG, TestCard);
    defineOnce(customElements, PLAN_PICTURE_ELEMENT, PlanPicture);
  });
  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(counts, { created: 0, started: 0, stopped: 0 });
    injected.current = countingDependencies();
  });
  afterEach(() => {
    document.body.replaceChildren();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
}

/** The real memoised builder, its result passed through `change`. */
export function wrapBuilder(change: (build: FloorModelBuilder) => FloorModelBuilder): () => FloorModelBuilder {
  return () => change(createFloorModelBuilder());
}

/**
 * Makes the card use the model the real builder gives, with `change` applied once per built model: the changed model
 * keeps its identity while the real one does, as the memoised builder's does, so a render is only caused by the rest of
 * the view.
 */
export function changeModel(change: (model: FloorModel) => FloorModel): void {
  injected.current.createModelBuilder = wrapBuilder((build) => {
    const changed = new WeakMap<FloorModel, FloorModel>();
    return (hass, sources) => {
      const model = build(hass, sources);
      const known = changed.get(model);
      if (known !== undefined) return known;
      const result = change(model);
      changed.set(model, result);
      return result;
    };
  });
}

/** Makes the card use the real model with `change` applied to the first floor's plan. */
export function withFirstFloorPlan(change: Partial<Plan>): void {
  changeModel((model) => ({
    ...model,
    floors: model.floors.map((floor, index) =>
      index === 0 ? { ...floor, plan: { ...floor.plan, ...change } } : floor,
    ),
  }));
}

/** The card's plan picture elements, in document order. */
export function pictures(card: VacuumMapCard): PlanPicture[] {
  return [...shadowOf(card).querySelectorAll(PLAN_PICTURE_ELEMENT)].filter((p) => p instanceof PlanPicture);
}

/** A fake frontend `hass` on the anonymised captures: two Roomba+ robots, two floors. */
export function fixtureHass(): FakeFrontendHass {
  return adaptersHarness().hass;
}

/** {@link fixtureHass} for an administrator or not, in `language` (`hass.language` and `hass.locale`, set together). */
export function hassAs(isAdmin: boolean, language = "en"): FakeFrontendHass {
  const hass = fixtureHass();
  hass.user = { is_admin: isAdmin };
  hass.language = language;
  hass.locale = { language };
  return hass;
}

/** The first floor's plan: its figure, room list and note. */
export function firstPlan(card: VacuumMapCard): Element | null {
  return shadowOf(card).querySelector("section .plan");
}

/** The captures without any registry entry, so no Roomba+ robot. */
export function noRobotHarness(): AdaptersHarness {
  const harness = adaptersHarness();
  harness.lists.set("config/entity_registry/list", []);
  return harness;
}

export function newCard(): TestCard {
  const card = document.createElement(TAG);
  if (!(card instanceof TestCard)) throw new Error("element is not a TestCard");
  card.setConfig({ type: "custom:vacuum-map-card" });
  return card;
}

/** Lets the adapters read their lists and waits for the render. */
export async function settle(card: TestCard): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
  await card.updateComplete;
}

export async function attach(card: TestCard): Promise<TestCard> {
  document.body.append(card);
  await settle(card);
  return card;
}

/** A new card given `hass` before it is attached, as a dashboard does. */
export async function mount(hass: unknown): Promise<TestCard> {
  const card = newCard();
  card.hass = hass;
  return attach(card);
}

export { shadowOf };

/** An element's text, whitespace collapsed; empty for no element. */
export function collapsedText(element: Element | null | undefined): string {
  return (element?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** The card's text without the title, whitespace collapsed. */
export function bodyText(card: VacuumMapCard): string {
  return collapsedText(shadowOf(card).querySelector(".content"));
}

export function statusRegion(card: VacuumMapCard): Element | null {
  return shadowOf(card).querySelector('[role="status"]');
}

/** The status region's text, whitespace collapsed. */
export function statusText(card: VacuumMapCard): string | undefined {
  return statusRegion(card)?.textContent?.replace(/\s+/g, " ").trim();
}

/** A new `hass` object over `base`, as the frontend makes one on every state change. */
export function nextHass(base: FakeFrontendHass, changes: Partial<FakeFrontendHass>): FakeFrontendHass {
  const next: FakeFrontendHass = Object.create(base);
  return Object.assign(next, changes);
}
