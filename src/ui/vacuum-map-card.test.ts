// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { VacuumMapCard } from "./vacuum-map-card";

const TAG = "vacuum-map-card-under-test";

beforeAll(() => {
  customElements.define(TAG, VacuumMapCard);
});

afterEach(() => {
  document.body.replaceChildren();
});

async function renderCard(): Promise<VacuumMapCard> {
  const card = document.createElement(TAG);
  if (!(card instanceof VacuumMapCard)) {
    throw new Error("element is not a VacuumMapCard");
  }
  card.setConfig({ type: "custom:vacuum-map-card" });
  document.body.append(card);
  await card.updateComplete;
  return card;
}

function shadowOf(card: VacuumMapCard): ShadowRoot {
  if (card.shadowRoot === null) {
    throw new Error("card has no shadow root");
  }
  return card.shadowRoot;
}

describe("VacuumMapCard", () => {
  it("stores the configuration it receives", async () => {
    const card = await renderCard();
    expect(card.config).toEqual({ type: "custom:vacuum-map-card" });
  });

  it("renders the title as light-DOM text of an ha-card", async () => {
    const card = await renderCard();
    const header = shadowOf(card).querySelector("ha-card > .card-header");
    expect(header?.textContent?.trim()).toBe("Vacuum Map Card");
  });

  it("keeps the title readable when ha-card is not defined", async () => {
    const card = await renderCard();
    expect(customElements.get("ha-card")).toBeUndefined();
    expect(shadowOf(card).textContent?.trim()).toBe("Vacuum Map Card");
  });

  it("does not change its output when hass is set", async () => {
    const card = await renderCard();
    const before = shadowOf(card).innerHTML;
    card.hass = { states: {} };
    await card.updateComplete;
    expect(shadowOf(card).innerHTML).toBe(before);
  });

  it("has nothing focusable yet", async () => {
    const card = await renderCard();
    expect(shadowOf(card).querySelectorAll("a, button, input, select, textarea, [tabindex]")).toHaveLength(0);
  });
});
