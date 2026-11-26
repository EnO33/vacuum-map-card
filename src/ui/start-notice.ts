import { html, type TemplateResult } from "lit";
import type { Locale, MessageKey } from "../i18n/catalogs";
import { localize } from "../i18n/localize";
import { type NoticeKind, notice } from "./notice";
import { reasonText } from "./robot-words";
import type { StartNotice } from "./start-flow";

/** Every notice in words and its tone: typed `Record`s, so a new kind without text or tone is a type error. */
const NOTICE_KEYS: Readonly<Record<StartNotice["kind"], MessageKey>> = {
  preview: "start.preview",
  cannot_start: "start.cannot_start",
  not_started: "start.not_started",
  busy: "start.busy",
  nothing_sent: "start.nothing_sent",
  not_asked: "start.not_asked",
};

/** Info while all is well, warning when the user has something to check or do; the icon says it too. */
const NOTICE_TONES: Readonly<Record<StartNotice["kind"], NoticeKind>> = {
  preview: "info",
  cannot_start: "warning",
  not_started: "warning",
  busy: "info",
  nothing_sent: "warning",
  not_asked: "warning",
};

/** The status line's sentences for a notice, the robot named as the card shows it; plain text. */
export function startNoticeLines(
  locale: Locale,
  start: StartNotice,
  robotName: (vacuumEntityId: string) => string,
): readonly string[] {
  if (start.kind === "preview") return [localize(locale, NOTICE_KEYS.preview)];
  const first = localize(locale, NOTICE_KEYS[start.kind], { robot: robotName(start.vacuumEntityId) });
  const reasons = start.kind === "cannot_start" ? start.reasons.map((reason) => reasonText(locale, reason)) : [];
  return [first, ...reasons];
}

/** The notice as the status line shows it: a box of its tone, the sentence first, then its reasons. */
export function startNoticeView(
  locale: Locale,
  start: StartNotice,
  robotName: (vacuumEntityId: string) => string,
): TemplateResult {
  const [first, ...reasons] = startNoticeLines(locale, start, robotName);
  return notice(
    NOTICE_TONES[start.kind],
    html`<p>${first}</p>${reasons.map((reason) => html`<p class="secondary">${reason}</p>`)}`,
  );
}
