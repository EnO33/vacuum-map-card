import { describe, expect, it } from "vitest";
import type { NoFloorNote, RoomsMapIssue } from "../app/floor-model/floor-model";
import type { PictureOnlyReason } from "../domain/plan/room-list";
import { CATALOGS, isLocale } from "../i18n/catalogs";
import { noFloorNotes, pictureOnlyNotes, roomsMapIssueText } from "./plan-notes";

const LOCALES = Object.keys(CATALOGS).filter(isLocale);
const PICTURE_ONLY: readonly PictureOnlyReason[] = [
  "no_clean_area",
  "mapping_absent",
  "mapping_unsupported",
  "no_area_on_this_map",
];
const NO_FLOOR: readonly NoFloorNote[] = [
  "assign_area_to_floor_plan",
  "assign_floor_to_area",
  "add_floor_alias",
  "enable_floor_plan",
  "cannot_tell_shown_map",
];

describe("plan notes", () => {
  it.each(LOCALES)("words every picture-only reason in %s, each differently", (locale) => {
    const texts = PICTURE_ONLY.map((reason) => pictureOnlyNotes(reason, true, locale)[0] ?? "");
    expect(texts.every((text) => text.length > 0)).toBe(true);
    expect(new Set(texts).size).toBe(PICTURE_ONLY.length);
  });

  it("says why cleaning cannot be started", () => {
    expect(pictureOnlyNotes("no_clean_area", false, "en")).toStrictEqual([
      "Cleaning cannot be started from this plan: this robot's rooms can only be chosen on the plan where the card draws them.",
    ]);
  });

  const MAPPING: readonly PictureOnlyReason[] = ["mapping_absent", "mapping_unsupported", "no_area_on_this_map"];

  it.each(MAPPING)("asks a non-administrator to ask an administrator for the mapping (%s)", (reason) => {
    expect(pictureOnlyNotes(reason, false, "en")[1]).toBe(
      "Ask an administrator to map your vacuum's segments to areas.",
    );
  });

  it.each(MAPPING)("tells an administrator where to map the segments (%s)", (reason) => {
    expect(pictureOnlyNotes(reason, true, "en")[1]).toBe("Map the vacuum's segments to areas in its entity settings.");
  });

  it("asks nothing more of a robot that cannot clean by area", () => {
    expect(pictureOnlyNotes("no_clean_area", true, "en")).toHaveLength(1);
  });

  it.each(LOCALES)("words every « no floor » note in %s, each differently", (locale) => {
    const notes = NO_FLOOR.map((note) => noFloorNotes([note], undefined, locale));
    const texts = notes.flatMap(({ fixes, facts }) => [...fixes, ...facts]);
    expect(texts).toHaveLength(NO_FLOOR.length);
    expect(texts.every((text) => text.length > 0)).toBe(true);
    expect(new Set(texts).size).toBe(NO_FLOOR.length);
  });

  it("keeps the fixes, which are alternatives, apart from what only explains or comes on top", () => {
    const notes = noFloorNotes(
      ["assign_area_to_floor_plan", "add_floor_alias", "enable_floor_plan", "cannot_tell_shown_map"],
      undefined,
      "en",
    );
    expect(notes.fixes).toStrictEqual([
      "Assign this floor plan to an area that is on a floor.",
      "Add this map's name as an alias of a floor.",
    ]);
    expect(notes.facts).toStrictEqual([
      "Enable this floor plan to show its picture.",
      "The card cannot tell which of the robot's maps this picture shows, so it cannot place it on a floor.",
    ]);
  });

  it("names the map in the alias fix, as text", () => {
    expect(noFloorNotes(["add_floor_alias"], "Upper <b>level</b>", "en").fixes).toStrictEqual([
      'Add "Upper <b>level</b>" as an alias of a floor.',
    ]);
  });

  const ISSUES: readonly RoomsMapIssue[] = [
    { kind: "absent" },
    { kind: "no_outlines" },
    { kind: "unsupported", reason: "malformed_attributes" },
    { kind: "unsupported", reason: "too_many_rooms" },
  ];

  it.each(LOCALES)("words every rooms map issue in %s with the robot's name", (locale) => {
    for (const issue of ISSUES) expect(roomsMapIssueText("Robot <b>", issue, locale)).toContain("Robot <b>");
  });

  it("says a robot has no outlines yet, or that they could not be read with the reason code", () => {
    expect(roomsMapIssueText("Robot", { kind: "absent" }, "en")).toBe("Robot: no room outlines yet");
    expect(roomsMapIssueText("Robot", { kind: "no_outlines" }, "en")).toBe("Robot: no room outlines yet");
    expect(roomsMapIssueText("Robot", { kind: "unsupported", reason: "duplicate_region_id" }, "en")).toBe(
      "Robot: room outlines could not be read (duplicate_region_id)",
    );
  });
});
