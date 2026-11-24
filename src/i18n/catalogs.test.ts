import { describe, expect, it } from "vitest";
import { CATALOGS, ENGLISH } from "./catalogs";
import { PLACEHOLDER } from "./localize";

/** Each key with its sorted, distinct placeholders: equal shapes mean the same keys and placeholder sets. */
function shape(catalog: Readonly<Record<string, string>>): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(catalog).map(([key, text]) => [
      key,
      [...new Set(Array.from(text.matchAll(PLACEHOLDER), (match) => match[0]))].sort(),
    ]),
  );
}

const locales = Object.entries(CATALOGS);

describe("catalogues", () => {
  it.each(locales)("%s has the same keys and placeholder sets as English", (_locale, catalog) => {
    expect(shape(catalog)).toEqual(shape(ENGLISH));
  });

  it.each(locales)("%s has no empty string", (_locale, catalog) => {
    expect(Object.values(catalog).filter((text) => text.trim() === "")).toEqual([]);
  });

  it("tells a renamed or dropped placeholder apart, not its order or repetition", () => {
    expect(shape({ a: "{y} {x} {y}" })).toEqual(shape({ a: "{x} {y}" }));
    expect(shape({ a: "{nom}" })).not.toEqual(shape({ a: "{name}" }));
    expect(shape({ a: "{y}" })).not.toEqual(shape({ a: "{x} {y}" }));
    expect(shape({ a: "x" })).not.toEqual(shape({ a: "x", b: "y" }));
  });
});
