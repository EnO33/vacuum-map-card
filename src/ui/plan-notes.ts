import type { NoFloorNote, RoomsMapIssue } from "../app/floor-model/floor-model";
import type { PictureOnlyReason } from "../domain/plan/room-list";
import type { Locale, MessageKey } from "../i18n/catalogs";
import { localize } from "../i18n/localize";

/**
 * One sentence per code, typed on the union so a new code without words is a type error. `mapping`: the fix is the
 * vacuum's segment mapping, which only an administrator can edit (ADR 0003 « Permissions »).
 */
const PICTURE_ONLY: Readonly<Record<PictureOnlyReason, { readonly key: MessageKey; readonly mapping: boolean }>> = {
  no_clean_area: { key: "picture_only.no_clean_area", mapping: false },
  mapping_absent: { key: "picture_only.mapping_absent", mapping: true },
  mapping_unsupported: { key: "picture_only.mapping_unsupported", mapping: true },
  no_area_on_this_map: { key: "picture_only.no_area_on_this_map", mapping: true },
};

/** `fix`: one of the alternatives that place the plan on a floor; `fact`: an explanation or a step on top of them. */
const NO_FLOOR: Readonly<Record<NoFloorNote, { readonly key: MessageKey; readonly role: "fix" | "fact" }>> = {
  assign_area_to_floor_plan: { key: "no_floor.assign_area_to_floor_plan", role: "fix" },
  assign_floor_to_area: { key: "no_floor.assign_floor_to_area", role: "fix" },
  add_floor_alias: { key: "no_floor.add_floor_alias", role: "fix" },
  cannot_tell_shown_map: { key: "no_floor.cannot_tell_shown_map", role: "fact" },
};

const ROOMS_MAP_ISSUE: Readonly<Record<RoomsMapIssue["kind"], MessageKey>> = {
  absent: "robot.no_outlines",
  no_outlines: "robot.no_outlines",
  unsupported: "robot.outlines_unreadable",
};

export interface PictureOnlyNotes {
  readonly lines: readonly string[];
  /** `true` when an administrator is told to map the segments in the vacuum's settings, which the card can open. */
  readonly vacuumSettings: boolean;
}

/**
 * Why a plan without outlines shows its picture only (ADR 0005 « Room lists » item 2), then, when the segment mapping
 * is the fix, where an administrator makes it, or that a non-administrator asks one (ADR 0003 « Permissions »).
 */
export function pictureOnlyNotes(reason: PictureOnlyReason, isAdmin: boolean, locale: Locale): PictureOnlyNotes {
  const { key, mapping } = PICTURE_ONLY[reason];
  const why = localize(locale, key);
  if (!mapping) return { lines: [why], vacuumSettings: false };
  const where = localize(locale, isAdmin ? "picture_only.map_segments" : "picture_only.ask_admin");
  return { lines: [why, where], vacuumSettings: isAdmin };
}

export interface NoFloorNotes {
  /** Alternatives: any one of them places the plan on a floor. */
  readonly fixes: readonly string[];
  /** Said on their own: an explanation, or a step that comes on top of the fixes. */
  readonly facts: readonly string[];
}

/**
 * A « no floor » plan's notes as Home Assistant fixes (ADR 0005 « Map to floor » source 4), in model order. The alias
 * fix names the map when its name is safe to show (`Plan.mapName`).
 */
export function noFloorNotes(notes: readonly NoFloorNote[], mapName: string | undefined, locale: Locale): NoFloorNotes {
  const text = (note: NoFloorNote) =>
    note === "add_floor_alias" && mapName !== undefined
      ? localize(locale, "no_floor.add_floor_alias_named", { map: mapName })
      : localize(locale, NO_FLOOR[note].key);
  const worded = (role: "fix" | "fact") => notes.filter((note) => NO_FLOOR[note].role === role).map(text);
  return { fixes: worded("fix"), facts: worded("fact") };
}

/** One line for a robot whose rooms map adds no plan; the reason code is a fixed code, never a map id. */
export function roomsMapIssueText(robot: string, issue: RoomsMapIssue, locale: Locale): string {
  const code = issue.kind === "unsupported" ? issue.reason : "";
  return localize(locale, ROOMS_MAP_ISSUE[issue.kind], { robot, code });
}
