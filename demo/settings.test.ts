import { describe, expect, it } from "vitest";
import { cardConfigOf, DEFAULT_SETTINGS, searchOf, settingsOf } from "./settings";

describe("demo settings", () => {
  it("defaults to light, tablet, an accepted action, the captured states and every plan", () => {
    expect(settingsOf("")).toStrictEqual({
      theme: "light",
      width: "tablet",
      outcome: "accepted",
      report: "captured",
      plans: "all",
    });
  });

  it("reads each setting from the query string", () => {
    expect(settingsOf("?theme=dark&width=phone&outcome=never&report=paused&plans=floors")).toStrictEqual({
      theme: "dark",
      width: "phone",
      outcome: "never",
      report: "paused",
      plans: "floors",
    });
  });

  it("replaces an unknown value by its default", () => {
    expect(settingsOf("?theme=sepia&width=huge&outcome=maybe&report=dancing&plans=some")).toStrictEqual(
      DEFAULT_SETTINGS,
    );
  });

  it("writes the settings back as a query string that reads the same", () => {
    const settings = {
      theme: "dark",
      width: "wide",
      outcome: "refused",
      report: "returning",
      plans: "floors",
    } as const;
    expect(searchOf(settings)).toBe("?theme=dark&width=wide&outcome=refused&report=returning&plans=floors");
    expect(settingsOf(searchOf(settings))).toStrictEqual(settings);
  });
});

describe("demo card configuration", () => {
  it("has no option when every plan is shown", () => {
    expect(cardConfigOf("all")).toStrictEqual({ type: "custom:vacuum-map-card" });
  });

  it("lists every demo floor when only plans on a floor are shown, so plans on no floor are hidden", () => {
    expect(cardConfigOf("floors")).toStrictEqual({
      type: "custom:vacuum-map-card",
      floors: ["ground_floor", "upper_floor"],
    });
  });
});
