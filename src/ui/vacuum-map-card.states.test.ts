// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { adaptersHarness } from "../../test/helpers/adapters";
import {
  attach,
  bodyText,
  fixtureHass,
  injected,
  LOADING,
  mount,
  newCard,
  nextHass,
  noRobotHarness,
  settle,
  shadowOf,
  statusRegion,
  statusText,
  useTestCard,
  wrapBuilder,
} from "../../test/helpers/card";
import { createAdapters } from "../adapters/create-adapters";
import type { FloorModel } from "../app/floor-model/floor-model";
import type { VacuumMapCard } from "./vacuum-map-card";

const ERROR = "The floor plans could not be shown. Reload the page to try again.";

useTestCard();

describe("VacuumMapCard states", () => {
  it("shows a loading status until the lists are read", async () => {
    const hass = fixtureHass();
    hass.answerWS = () => new Promise(() => undefined);
    expect(statusText(await mount(hass))).toBe(LOADING);
  });

  it("lists the floor names outside the status region once the model is read", async () => {
    const card = await mount(fixtureHass());
    const items = [...shadowOf(card).querySelectorAll("li")].map((li) => li.textContent?.trim());
    expect(items).toStrictEqual(["Ground floor", "Upper floor", "Plans without a floor"]);
    expect(statusText(card)).toBe("");
  });

  it("says no supported robot was found, naming the integration, in the same status region as the loading", async () => {
    const { hass, lists } = noRobotHarness();
    const registry = lists.get("config/entity_registry/list");
    lists.delete("config/entity_registry/list");
    let answer: (value: unknown) => void = () => undefined;
    const fixtures = hass.answerWS;
    hass.answerWS = (message) =>
      message.type === "config/entity_registry/list" ? new Promise((resolve) => (answer = resolve)) : fixtures(message);
    const card = await mount(hass);
    const region = statusRegion(card);
    expect(statusText(card)).toBe(LOADING);
    answer(registry);
    await settle(card);
    expect(statusRegion(card)).toBe(region);
    expect(statusText(card)).toBe("No supported robot found This card works with robots from the Roomba+ integration.");
  });

  it("names every supported integration in one sentence", async () => {
    injected.current.createAdapters = (getHass) => ({
      ...createAdapters(getHass),
      integrations: ["Roomba+", "Other"],
    });
    const card = await mount(noRobotHarness().hass);
    expect(bodyText(card)).toContain("from the Roomba+ or Other integration.");
  });

  it("says no plan was found when the robots have none", async () => {
    injected.current.createModelBuilder = wrapBuilder((build) => (hass, sources) => ({
      ...build(hass, sources),
      floors: [],
      noFloor: [],
    }));
    const card = await mount(fixtureHass());
    expect(statusText(card)).toBe("No floor plan found.");
    expect(shadowOf(card).querySelector("ul")).toBeNull();
  });

  it("speaks French when the user's language is French", async () => {
    const { hass } = noRobotHarness();
    hass.language = "fr";
    hass.locale = { language: "fr-FR" };
    const card = await mount(hass);
    expect(bodyText(card)).toBe(
      "Aucun robot compatible trouvé Cette carte fonctionne avec les robots de l'intégration Roomba+.",
    );
    expect(shadowOf(card).querySelector(".card-header")?.textContent?.trim()).toBe("Vacuum Map Card");
  });

  it("follows a change of the lists that a subscription signals", async () => {
    const harness = adaptersHarness();
    const card = await mount(harness.hass);
    harness.lists.set("config/entity_registry/list", []);
    harness.hass.connection.emit("entity_registry_updated");
    await vi.advanceTimersByTimeAsync(1000);
    await card.updateComplete;
    expect(bodyText(card)).toContain("No supported robot found");
  });

  it("keeps the title and has nothing focusable", async () => {
    const card = await mount(fixtureHass());
    expect(shadowOf(card).querySelector("ha-card > .card-header")?.textContent?.trim()).toBe("Vacuum Map Card");
    expect(shadowOf(card).querySelectorAll("a, button, input, select, textarea, [tabindex]")).toHaveLength(0);
  });
});

describe("VacuumMapCard errors", () => {
  const SECRET = "boom /api/image_proxy/image.x?token=abc vacuum.robot_one";

  function expectShortError(card: VacuumMapCard, text = ERROR): void {
    expect(statusText(card)).toBe(text);
    expect(shadowOf(card).innerHTML).not.toContain("token");
    expect(shadowOf(card).innerHTML).not.toContain("vacuum.robot_one");
  }

  it("shows a short error when building the model throws, and recovers when it no longer does", async () => {
    let fail = true;
    injected.current.createModelBuilder = wrapBuilder((build) => (hass, sources) => {
      if (fail) throw new Error(SECRET);
      return build(hass, sources);
    });
    const card = newCard();
    const hass = fixtureHass();
    expect(() => {
      card.hass = hass;
    }).not.toThrow();
    await attach(card);
    expectShortError(card);
    fail = false;
    card.hass = nextHass(hass, {});
    await settle(card);
    expect(bodyText(card)).toContain("Ground floor");
  });

  it("shows a short error when rendering the model throws", async () => {
    const throwing: FloorModel = {
      loading: false,
      floors: [],
      noFloor: [],
      get robots(): never {
        throw new Error(SECRET);
      },
    };
    injected.current.createModelBuilder = () => () => throwing;
    expectShortError(await mount(fixtureHass()));
  });

  it("shows a short error in the user's language when the adapters cannot start, until an invalid hass stops them", async () => {
    injected.current.createAdapters = (getHass) => ({
      ...createAdapters(getHass),
      start: () => {
        throw new Error(SECRET);
      },
    });
    const hass = fixtureHass();
    hass.language = "fr";
    hass.locale = { language: "fr" };
    const card = await mount(hass);
    expectShortError(card, "Les plans n'ont pas pu être affichés. Rechargez la page pour réessayer.");
    card.hass = nextHass(hass, {});
    await settle(card);
    expectShortError(card, "Les plans n'ont pas pu être affichés. Rechargez la page pour réessayer.");
    card.hass = undefined;
    await settle(card);
    expect(statusText(card)).toBe("Chargement des plans…");
  });
});
