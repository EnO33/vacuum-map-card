import { html, nothing, type TemplateResult } from "lit";
import type { RobotModel } from "../app/floor-model/floor-model";
import type { Locale } from "../i18n/catalogs";
import { type NoticeKind, notice, noticeLines } from "./notice";
import { type RobotNames, robotNameIn } from "./plan-display";
import { roomsMapIssueText } from "./plan-notes";

/** The robots with a rooms map issue, so the card's size can count their notes. */
export function hasRobotNotes(robots: readonly RobotModel[]): boolean {
  return robots.some(({ roomsMapIssue }) => roomsMapIssue !== undefined);
}

/**
 * One line under the plans for each robot whose rooms map adds no plan, by the robot's name, in model order: a note
 * for outlines not there yet, a warning for outlines that could not be read. Nothing when every rooms map adds a plan.
 */
export function robotNotes(
  robots: readonly RobotModel[],
  names: RobotNames,
  locale: Locale,
): TemplateResult | typeof nothing {
  const lines = robots.flatMap(({ vacuumEntityId, roomsMapIssue }) => {
    if (roomsMapIssue === undefined) return [];
    const kind: NoticeKind = roomsMapIssue.kind === "unsupported" ? "warning" : "info";
    return [{ kind, text: roomsMapIssueText(robotNameIn(names, vacuumEntityId), roomsMapIssue, locale) }];
  });
  if (lines.length === 0) return nothing;
  const KINDS: readonly NoticeKind[] = ["info", "warning"];
  return html`<div class="robot-notes">
    ${KINDS.map((kind) => {
      const shown = lines.filter((line) => line.kind === kind).map((line) => line.text);
      return shown.length === 0 ? nothing : notice(kind, noticeLines(shown));
    })}
  </div>`;
}
