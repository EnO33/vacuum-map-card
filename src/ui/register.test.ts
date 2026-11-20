// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { defineOnce, withCustomCard } from "./register";

const entry = {
  type: "vacuum-map-card",
  name: "Vacuum Map Card",
  preview: false,
  documentationURL: "https://github.com/EnO33/vacuum-map-card",
};

describe("withCustomCard", () => {
  it("starts a list when there is none", () => {
    expect(withCustomCard(undefined, entry)).toEqual([entry]);
  });

  it("starts a list when the existing value is not an array", () => {
    expect(withCustomCard("broken", entry)).toEqual([entry]);
  });

  it("keeps the cards already listed and appends its own", () => {
    const other = { type: "other-card" };
    const cards = [other];
    expect(withCustomCard(cards, entry)).toBe(cards);
    expect(cards).toEqual([other, entry]);
  });

  it("adds its entry only once", () => {
    const cards = withCustomCard(withCustomCard([], entry), entry);
    expect(cards).toEqual([entry]);
  });

  it("ignores listed values that are not entries", () => {
    expect(withCustomCard([null, 3, { name: "no type" }], entry)).toHaveLength(4);
  });
});

describe("defineOnce", () => {
  it("defines the element the first time and reports it", () => {
    class First extends HTMLElement {}
    expect(defineOnce(customElements, "define-once-first", First)).toBe(true);
    expect(customElements.get("define-once-first")).toBe(First);
  });

  it("leaves an existing definition alone", () => {
    class Original extends HTMLElement {}
    class Again extends HTMLElement {}
    defineOnce(customElements, "define-once-again", Original);
    expect(defineOnce(customElements, "define-once-again", Again)).toBe(false);
    expect(customElements.get("define-once-again")).toBe(Original);
  });
});
