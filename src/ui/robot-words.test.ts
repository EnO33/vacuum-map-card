import { describe, expect, it } from "vitest";
import { CATALOGS, isLocale } from "../i18n/catalogs";
import { ACTION_KEYS, actionText, REASON_KEYS, reasonText, robotState } from "./robot-words";

const LOCALES = Object.keys(CATALOGS).filter(isLocale);

describe("robot words", () => {
  it.each(LOCALES)("gives every action its own text in %s", (locale) => {
    const catalog = new Map(Object.entries(CATALOGS[locale]));
    const keys = Object.values(ACTION_KEYS);
    expect(keys.every((key) => (catalog.get(key) ?? "") !== "")).toBe(true);
    expect(new Set(keys.map((key) => catalog.get(key))).size).toBe(keys.length);
  });

  it.each(LOCALES)("gives every reason its own sentence in %s", (locale) => {
    const catalog = new Map(Object.entries(CATALOGS[locale]));
    const keys = Object.values(REASON_KEYS);
    expect(keys.every((key) => /[.!]$/.test(catalog.get(key) ?? ""))).toBe(true);
    expect(new Set(keys.map((key) => catalog.get(key))).size).toBe(keys.length);
  });

  it("words an action and a reason", () => {
    expect(actionText("en", "vacuum_then_mop")).toBe("Vacuum, then mop");
    expect(actionText("fr", "mop")).toBe("Laver le sol");
    expect(reasonText("en", "unavailable")).toBe("Check that the robot is on and connected to Home Assistant.");
    expect(reasonText("fr", "unavailable")).toBe("Vérifiez que le robot est allumé et connecté à Home Assistant.");
  });

  it.each([
    ["cleaning", "Cleaning", "cleaning"],
    ["docked", "Docked", "docked"],
    ["idle", "Idle", "idle"],
    ["paused", "Paused", "paused"],
    ["returning", "Returning to dock", "returning"],
    ["error", "Error", "error"],
    ["unavailable", "Unavailable", "unavailable"],
  ] as const)("words the state %s and gives its colour", (state, text, tone) => {
    expect(robotState("en", state)).toEqual({ text, tone });
  });

  it.each([["unknown"], ["mystery<b>"], [undefined], ["constructor"]])(
    "words %s as an unknown state, never the raw code",
    (state) => {
      expect(robotState("en", state)).toEqual({ text: "Unknown state", tone: "unknown" });
      expect(robotState("fr", state).text).toBe("État inconnu");
    },
  );
});
