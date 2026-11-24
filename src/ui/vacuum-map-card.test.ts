// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  attach,
  bodyText,
  counts,
  fixtureHass,
  injected,
  LOADING,
  mount,
  newCard,
  nextHass,
  settle,
  statusText,
  useTestCard,
} from "../../test/helpers/card";
import { roombaPlusStates } from "../../test/helpers/roomba-plus-states";
import { createAdapters } from "../adapters/create-adapters";

const noop = () => undefined;

useTestCard();

describe("VacuumMapCard lifecycle", () => {
  it("stores the configuration it receives", () => {
    expect(newCard().config).toStrictEqual({ type: "custom:vacuum-map-card" });
  });

  it("starts the adapters once connected with a valid hass, and stops them when disconnected", async () => {
    const card = await attach(newCard());
    expect(counts).toStrictEqual({ created: 0, started: 0, stopped: 0 });
    card.hass = fixtureHass();
    expect(counts).toStrictEqual({ created: 1, started: 1, stopped: 0 });
    card.hass = fixtureHass();
    expect(counts).toStrictEqual({ created: 1, started: 1, stopped: 0 });
    card.remove();
    expect(counts).toStrictEqual({ created: 1, started: 1, stopped: 1 });
  });

  it("makes new adapters when it is attached again", async () => {
    const card = newCard();
    card.hass = fixtureHass();
    expect(counts.created).toBe(0);
    await attach(card);
    card.remove();
    await attach(card);
    expect(counts).toStrictEqual({ created: 2, started: 2, stopped: 1 });
    expect(bodyText(card)).toContain("Ground floor");
  });

  it.each([
    ["undefined", undefined],
    ["an object without the frontend functions", { states: {}, language: "en" }],
    ["a connection without subscribeEvents", { callWS: noop, callService: noop, hassUrl: noop, connection: {} }],
  ])("shows the loading state and starts nothing for %s", async (_case, value) => {
    const card = await mount(value);
    expect(counts.created).toBe(0);
    expect(statusText(card)).toBe(LOADING);
  });

  it("stops the adapters when a value that fails the check replaces a valid hass", async () => {
    const card = await mount(fixtureHass());
    card.hass = null;
    await card.updateComplete;
    expect(counts).toStrictEqual({ created: 1, started: 1, stopped: 1 });
    expect(statusText(card)).toBe(LOADING);
  });

  it("releases its subscription even when stopping the adapters throws, and the other way round", async () => {
    const released: string[] = [];
    injected.current.createAdapters = (getHass) => {
      const adapters = createAdapters(getHass);
      return {
        ...adapters,
        hass: {
          ...adapters.hass,
          subscribe: (listener) => {
            const unsubscribe = adapters.hass.subscribe(listener);
            return () => {
              unsubscribe();
              released.push("subscription");
              throw new Error("unsubscribe");
            };
          },
        },
        stop: () => {
          adapters.stop();
          released.push("adapters");
          throw new Error("stop");
        },
      };
    };
    const card = await mount(fixtureHass());
    expect(() => card.remove()).not.toThrow();
    expect(released).toStrictEqual(["adapters", "subscription"]);
  });
});

describe("VacuumMapCard renders", () => {
  it("renders once over 50 hass objects where only an unrelated entity changes, then once for a new language", async () => {
    const base = fixtureHass();
    const robots = roombaPlusStates();
    base.states = robots;
    const card = await mount(base);
    card.renders = 0;
    let hass = base;
    for (let i = 0; i < 50; i++) {
      const states = { ...robots, "sensor.unrelated": { state: String(i), attributes: {} } };
      hass = nextHass(hass, i === 25 ? { states, language: "fr", locale: { language: "fr" } } : { states });
      card.hass = hass;
      await settle(card);
      expect(card.renders).toBe(i < 25 ? 0 : 1);
    }
    expect(card.hass).toBe(hass);
  });
});
