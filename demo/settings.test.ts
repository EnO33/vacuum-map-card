import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, searchOf, settingsOf } from "./settings";

describe("demo settings", () => {
  it("defaults to light, tablet and an accepted action", () => {
    expect(settingsOf("")).toStrictEqual({ theme: "light", width: "tablet", outcome: "accepted" });
  });

  it("reads each setting from the query string", () => {
    expect(settingsOf("?theme=dark&width=phone&outcome=never")).toStrictEqual({
      theme: "dark",
      width: "phone",
      outcome: "never",
    });
  });

  it("replaces an unknown value by its default", () => {
    expect(settingsOf("?theme=sepia&width=huge&outcome=maybe")).toStrictEqual(DEFAULT_SETTINGS);
  });

  it("writes the settings back as a query string that reads the same", () => {
    const settings = { theme: "dark", width: "wide", outcome: "refused" } as const;
    expect(searchOf(settings)).toBe("?theme=dark&width=wide&outcome=refused");
    expect(settingsOf(searchOf(settings))).toStrictEqual(settings);
  });
});
