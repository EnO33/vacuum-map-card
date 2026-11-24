import { describe, expect, it } from "vitest";
import en from "./en.json";
import fr from "./fr.json";
import { localize, translate } from "./localize";

describe("localize", () => {
  it.each([
    ["en", en["card.loading"]],
    ["fr", fr["card.loading"]],
  ] as const)("returns the %s string", (locale, text) => {
    expect(localize(locale, "card.loading")).toBe(text);
  });

  it("replaces a placeholder with its parameter", () => {
    expect(localize("en", "card.no_robot_hint", { integration: "Robot Plus" })).toBe(
      "This card works with robots from the Robot Plus integration.",
    );
  });

  it("rejects an unknown key at compile time", () => {
    // @ts-expect-error: the key type is derived from en.json.
    const unknownKey = () => localize("en", "card.unknown");
    expect(unknownKey).toBeTypeOf("function");
  });
});

describe("translate", () => {
  it("falls back to English for a key missing in the catalogue", () => {
    expect(translate({}, "card.no_robot")).toBe(en["card.no_robot"]);
  });

  it("uses the catalogue's own string when it has the key", () => {
    expect(translate({ "card.no_robot": "Pas de robot" }, "card.no_robot")).toBe("Pas de robot");
  });

  it.each([
    ["markup", "<img src=x onerror=alert(1)>"],
    ["an entity", "Tom &amp; Jerry & co"],
    ["another placeholder", "{integration} {name}"],
    ["a replacement pattern", "$& $1 $$"],
  ])("inserts a value holding %s unchanged and expands it once", (_case, value) => {
    expect(translate({ "card.no_robot": "[{name}]" }, "card.no_robot", { name: value })).toBe(`[${value}]`);
  });

  it("leaves no raw placeholder when a parameter is missing", () => {
    expect(translate({ "card.no_robot": "a {name} b {other}" }, "card.no_robot", { other: "x" })).toBe("a  b x");
  });

  it("ignores inherited properties of the parameters", () => {
    expect(translate({ "card.no_robot": "[{toString}]" }, "card.no_robot", {})).toBe("[]");
  });

  it("keeps braces that are not a placeholder", () => {
    expect(translate({ "card.no_robot": "{ a } {} {1x}" }, "card.no_robot")).toBe("{ a } {} {1x}");
  });
});
