import { describe, expect, it } from "vitest";
import { resolveLocale } from "./locale";

describe("resolveLocale", () => {
  it.each([
    ["fr", "fr"],
    ["en", "en"],
    ["FR", "fr"],
    ["fr-CA", "fr"],
    ["FR-ca", "fr"],
    ["en-GB", "en"],
  ])("resolves the language %j to %j", (language, locale) => {
    expect(resolveLocale(language)).toBe(locale);
  });

  it.each([
    ["de"],
    ["zh-Hans"],
    ["-fr"],
    ["constructor"],
    ["__proto__-fr"],
    [""],
    [undefined],
    [null],
    [42],
    [{ language: "fr" }],
  ])("falls back to English for %j", (language) => {
    expect(resolveLocale(language)).toBe("en");
  });
});
