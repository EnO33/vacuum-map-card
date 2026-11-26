import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, searchOf, settingsOf } from "./settings";

describe("demo settings", () => {
  it("defaults to light, tablet, an accepted action and the captured states", () => {
    expect(settingsOf("")).toStrictEqual({ theme: "light", width: "tablet", outcome: "accepted", report: "captured" });
  });

  it("reads each setting from the query string", () => {
    expect(settingsOf("?theme=dark&width=phone&outcome=never&report=paused")).toStrictEqual({
      theme: "dark",
      width: "phone",
      outcome: "never",
      report: "paused",
    });
  });

  it("replaces an unknown value by its default", () => {
    expect(settingsOf("?theme=sepia&width=huge&outcome=maybe&report=dancing")).toStrictEqual(DEFAULT_SETTINGS);
  });

  it("writes the settings back as a query string that reads the same", () => {
    const settings = { theme: "dark", width: "wide", outcome: "refused", report: "returning" } as const;
    expect(searchOf(settings)).toBe("?theme=dark&width=wide&outcome=refused&report=returning");
    expect(settingsOf(searchOf(settings))).toStrictEqual(settings);
  });
});
