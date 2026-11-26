import type { NotStartableReason } from "../app/robots-for-item/choice";
import type { ActionKind } from "../domain/robot/action-kind";
import { isVacuumState, type VacuumState } from "../domain/robot/vacuum-state";
import type { Locale, MessageKey } from "../i18n/catalogs";
import { localize } from "../i18n/localize";

/** Every action in words: a typed `Record`, so a new `ActionKind` without text is a type error. */
export const ACTION_KEYS: Readonly<Record<ActionKind, MessageKey>> = {
  vacuum: "action.vacuum",
  mop: "action.mop",
  vacuum_and_mop: "action.vacuum_and_mop",
  vacuum_then_mop: "action.vacuum_then_mop",
  clean: "action.clean",
};

/** One sentence per reason a robot cannot start: a typed `Record`, so a new code without text is a type error. */
export const REASON_KEYS: Readonly<Record<NotStartableReason, MessageKey>> = {
  unavailable: "reason.unavailable",
  no_state: "reason.no_state",
  no_clean_area: "reason.no_clean_area",
  service_missing: "reason.service_missing",
  mapping_absent: "reason.mapping_absent",
  mapping_unsupported: "reason.mapping_unsupported",
  area_not_mapped: "reason.area_not_mapped",
  no_core_area: "reason.no_core_area",
  several_areas: "reason.several_areas",
  area_spans_maps: "reason.area_spans_maps",
  segment_map_unknown: "reason.segment_map_unknown",
  segment_unnamed: "reason.segment_unnamed",
  segments_changed_open: "reason.segments_changed_open",
  region_id_unsafe: "reason.region_id_unsafe",
  no_room_action: "reason.no_room_action",
  name_shadows_id: "reason.name_shadows_id",
  shadow_check_impossible: "reason.shadow_check_impossible",
  room_action_wrong_robot: "reason.room_action_wrong_robot",
};

/**
 * Core's vacuum states in words, plus `unavailable`. Each is also the class of its state dot, whose colour copies the
 * frontend's chain (ADR 0004 « State colours »).
 */
const STATE_KEYS: Readonly<Record<VacuumState | "unavailable", MessageKey>> = {
  cleaning: "state.cleaning",
  docked: "state.docked",
  idle: "state.idle",
  paused: "state.paused",
  returning: "state.returning",
  error: "state.error",
  unavailable: "state.unavailable",
};

/** A state dot's class: a known state, or `unknown` for `unknown`, a missing state and any other code. */
export type StateTone = VacuumState | "unavailable" | "unknown";

export interface RobotStateWords {
  readonly text: string;
  readonly tone: StateTone;
}

export function actionText(locale: Locale, action: ActionKind): string {
  return localize(locale, ACTION_KEYS[action]);
}

export function reasonText(locale: Locale, reason: NotStartableReason): string {
  return localize(locale, REASON_KEYS[reason]);
}

/** A robot's state in words and its dot's class. A code the card does not know is never shown: « Unknown state ». */
export function robotState(locale: Locale, state: string | undefined): RobotStateWords {
  const tone = state === "unavailable" || isVacuumState(state) ? state : "unknown";
  return { text: localize(locale, tone === "unknown" ? "state.unknown" : STATE_KEYS[tone]), tone };
}
