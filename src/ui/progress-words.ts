import type { ProgressEntry } from "../app/progress/progress-tracker";
import type { CleanError, CleanErrorKind } from "../domain/clean/clean-error";
import type { ProgressPhase } from "../domain/clean/progress";
import type { Locale, MessageKey } from "../i18n/catalogs";
import { localize } from "../i18n/localize";
import { type PictureOnlyNotes, segmentMappingFix } from "./plan-notes";

/** Each phase's short label, shown on the room, and its sentence, said in the status line and the room's progress. */
export const PHASE_KEYS: Readonly<
  Record<ProgressPhase, { readonly label: MessageKey; readonly sentence: MessageKey }>
> = {
  sending: { label: "phase.sending", sentence: "progress.sending" },
  starting: { label: "phase.starting", sentence: "progress.starting" },
  cleaning: { label: "phase.cleaning", sentence: "progress.cleaning" },
  paused: { label: "phase.paused", sentence: "progress.paused" },
  done: { label: "phase.done", sentence: "progress.done" },
  failed: { label: "phase.failed", sentence: "progress.failed" },
  may_have_started: { label: "phase.may_have_started", sentence: "progress.may_have_started" },
  not_started: { label: "phase.not_started", sentence: "progress.not_started" },
};

/**
 * The card's own sentence for each refused start (ADR 0003 « Errors »), typed on the union so a new kind without words
 * is a type error. A meaning the robot list already words keeps its sentence.
 */
export const CLEAN_ERROR_KEYS: Readonly<Record<CleanErrorKind, MessageKey>> = {
  card_problem: "error.card_problem",
  no_area_cleaning: "reason.no_clean_area",
  not_allowed: "error.not_allowed",
  not_set_up_for_area_cleaning: "error.not_set_up_for_area_cleaning",
  rooms_not_linked: "reason.mapping_absent",
  area_not_linked: "reason.area_not_mapped",
  ha_lacks_area_cleaning: "reason.service_missing",
  no_room_map: "error.no_room_map",
  no_rooms_on_account: "error.no_rooms_on_account",
  nothing_to_clean: "error.nothing_to_clean",
  room_is_a_zone: "error.room_is_a_zone",
  room_not_found: "error.room_not_found",
  cloud_account_required: "error.cloud_account_required",
  map_updating: "error.map_updating",
  integration_not_ready: "error.integration_not_ready",
  rooms_on_different_maps: "error.rooms_on_different_maps",
  room_not_on_current_map: "error.room_not_on_current_map",
  room_list_not_loaded: "error.room_list_not_loaded",
  room_map_unknown: "error.room_map_unknown",
  unknown: "error.unknown",
};

/** Whether the robot could be moving anyway, said after the error (ADR 0003 « Errors »); nothing when it cannot. */
const MAY_HAVE_STARTED: Readonly<Record<CleanError["mayHaveStarted"], MessageKey | undefined>> = {
  no: undefined,
  possibly: "progress.possibly_started",
  unknown: "progress.unknown_if_started",
};

/** Names as the card shows them: plain text, often untrusted. */
export interface ProgressNames {
  readonly robot: string;
  readonly room: string;
}

/** Plain text lines, and whether the vacuum's settings button goes with them. */
export type ProgressLines = PictureOnlyNotes;

/** The label on the room: its phase, or « Status unknown » while the robot's state cannot be read. */
export function phaseLabel(locale: Locale, { phase, statusUnknown }: ProgressEntry): string {
  return localize(locale, statusUnknown ? "phase.status_unknown" : PHASE_KEYS[phase].label);
}

/**
 * One robot's progress on a room in words: its phase, then for a refused start the card's own sentence, the server's
 * message for an unknown error only, whether the robot may have started, and what a non-administrator asks an
 * administrator (ADR 0003 « Errors », « Permissions »). Ends with « Status unknown » while the state cannot be read.
 */
export function progressLines(
  locale: Locale,
  entry: ProgressEntry,
  names: ProgressNames,
  isAdmin: boolean,
): ProgressLines {
  const { phase, error, statusUnknown } = entry;
  const head = phase === "failed" && error !== undefined ? "progress.refused" : PHASE_KEYS[phase].sentence;
  const lines = [localize(locale, head, { ...names })];
  let vacuumSettings = false;
  if (error !== undefined) {
    lines.push(localize(locale, CLEAN_ERROR_KEYS[error.kind]));
    if (error.kind === "unknown" && error.fallbackMessage !== undefined)
      lines.push(localize(locale, "progress.message", { message: error.fallbackMessage }));
    const started = MAY_HAVE_STARTED[error.mayHaveStarted];
    if (started !== undefined) lines.push(localize(locale, started, { robot: names.robot }));
    if (error.kind === "rooms_not_linked") {
      const fix = segmentMappingFix(isAdmin, locale);
      lines.push(fix.line);
      vacuumSettings = fix.vacuumSettings;
    } else if (error.kind === "not_allowed" && !isAdmin) {
      lines.push(localize(locale, "progress.ask_admin_control"));
    }
  }
  if (statusUnknown) lines.push(localize(locale, "progress.status_unknown", { robot: names.robot }));
  return { lines, vacuumSettings };
}

/** A room's accessible name with each robot's phase on it, so a screen reader hears the progress with the room. */
export function roomNameWithProgress(
  locale: Locale,
  room: string,
  entries: readonly ProgressEntry[],
  robotName: (vacuumEntityId: string) => string,
): string {
  const phases = entries.map((entry) =>
    localize(locale, "progress.robot_phase", {
      robot: robotName(entry.vacuumEntityId),
      phase: phaseLabel(locale, entry),
    }),
  );
  return [room, ...phases].join(", ");
}
