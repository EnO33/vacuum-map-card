import { describe, expect, it } from "vitest";
import type { ProgressEntry } from "../app/progress/progress-tracker";
import type { ItemRef } from "../app/robots-for-item/robots-for-item";
import type { CleanError, CleanErrorKind } from "../domain/clean/clean-error";
import type { ProgressPhase } from "../domain/clean/progress";
import { CATALOGS, isLocale, type Locale } from "../i18n/catalogs";
import { CLEAN_ERROR_KEYS, PHASE_KEYS, phaseLabel, progressLines, roomNameWithProgress } from "./progress-words";

const item: ItemRef = { kind: "area", imageEntityId: "image.plan", areaId: "library" };
const names = { robot: "Robot <one>", room: "Library <b>" };
const locales = Object.keys(CATALOGS).filter(isLocale);

function entry(phase: ProgressPhase, extra: Partial<ProgressEntry> = {}): ProgressEntry {
  return { vacuumEntityId: "vacuum.one", item, phase, statusUnknown: false, ...extra };
}

function error(kind: CleanErrorKind, mayHaveStarted: CleanError["mayHaveStarted"] = "no"): CleanError {
  return { kind, mayHaveStarted };
}

const lines = (e: ProgressEntry, isAdmin = true, locale: Locale = "en") =>
  progressLines(locale, e, names, isAdmin).lines;

describe("progress words", () => {
  describe.each(locales)("in %s", (locale) => {
    it.each(Object.entries(PHASE_KEYS))("words the phase %s", (_phase, key) => {
      expect(CATALOGS[locale][key.label]).toBeTruthy();
      expect(CATALOGS[locale][key.sentence]).toBeTruthy();
    });

    it.each(Object.entries(CLEAN_ERROR_KEYS))("words the error %s", (_kind, key) => {
      expect(CATALOGS[locale][key]).toBeTruthy();
    });
  });

  it("labels a phase, or status unknown in its place", () => {
    expect(phaseLabel("en", entry("cleaning"))).toBe("Cleaning");
    expect(phaseLabel("fr", entry("done"))).toBe("Terminé");
    expect(phaseLabel("en", entry("cleaning", { statusUnknown: true }))).toBe("Status unknown");
  });

  it.each<[ProgressPhase, string]>([
    ["sending", "Sending the start to Robot <one> for Library <b>…"],
    ["starting", "Robot <one> is starting to clean Library <b>."],
    ["cleaning", "Robot <one> is cleaning Library <b>."],
    ["paused", "Robot <one> is paused in Library <b>."],
    ["done", "Robot <one> finished cleaning Library <b>."],
    ["failed", "Robot <one> stopped with an error while cleaning Library <b>."],
    ["not_started", "Nothing was sent to Robot <one> for Library <b>: the room or robot changed. Try again."],
  ])("says %s in one sentence, names as text", (phase, sentence) => {
    expect(lines(entry(phase))).toEqual([sentence]);
  });

  it("says a refused start, then why", () => {
    expect(lines(entry("failed", { error: error("map_updating") }))).toEqual([
      "Robot <one> could not be sent to Library <b>.",
      "The robot is rebuilding its map. Try again later.",
    ]);
  });

  it("says the robot may have started, and to check it when that is unknown", () => {
    expect(lines(entry("may_have_started", { error: error("area_not_linked", "possibly") }))).toEqual([
      "Starting Robot <one> for Library <b> returned an error.",
      "None of the robot's segments is mapped to this area.",
      "Robot <one> may have started.",
    ]);
    expect(
      lines(entry("may_have_started", { error: { ...error("unknown", "unknown"), fallbackMessage: "<i>x</i>" } })),
    ).toEqual([
      "Starting Robot <one> for Library <b> returned an error.",
      "The start failed for a reason the card does not know.",
      "Message from Home Assistant: <i>x</i>",
      "Robot <one> may have started: check it.",
    ]);
  });

  it("shows the fallback message only for an unknown error", () => {
    const e = entry("failed", { error: { kind: "map_updating", mayHaveStarted: "no", fallbackMessage: "raw" } });
    expect(lines(e).join(" ")).not.toContain("raw");
  });

  it("tells a non-administrator to ask an administrator, and an administrator where to map", () => {
    const notLinked = entry("failed", { error: error("rooms_not_linked") });
    expect(progressLines("en", notLinked, names, false)).toEqual({
      lines: [
        "Robot <one> could not be sent to Library <b>.",
        "The robot's segments are not mapped to areas yet.",
        "Ask an administrator to map your vacuum's segments to areas.",
      ],
      vacuumSettings: false,
    });
    expect(progressLines("en", notLinked, names, true)).toMatchObject({
      lines: [expect.any(String), expect.any(String), "Map the vacuum's segments to areas in its entity settings."],
      vacuumSettings: true,
    });
    const notAllowed = entry("failed", { error: error("not_allowed") });
    expect(lines(notAllowed, false).at(-1)).toBe("Ask an administrator to let you control this robot.");
    expect(lines(notAllowed, true)).toHaveLength(2);
  });

  it("adds status unknown last", () => {
    expect(lines(entry("cleaning", { statusUnknown: true }))).toEqual([
      "Robot <one> is cleaning Library <b>.",
      "Status unknown: Robot <one> is unavailable.",
    ]);
  });

  it("speaks French", () => {
    // The names come quoted from `progressNames`: the sentence takes them as they are.
    expect(lines(entry("cleaning"), true, "fr")).toEqual(["Robot <one> nettoie Library <b>."]);
  });

  it("names a room with each robot's phase", () => {
    const robotName = (id: string) => (id === "vacuum.one" ? "Robot one" : "Robot two");
    expect(roomNameWithProgress("en", "Library", [], robotName)).toBe("Library");
    expect(
      roomNameWithProgress(
        "en",
        "Library",
        [entry("cleaning"), entry("done", { vacuumEntityId: "vacuum.two" })],
        robotName,
      ),
    ).toBe("Library, Robot one: Cleaning, Robot two: Done");
  });
});
