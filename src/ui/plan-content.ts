import { css, html, nothing, type TemplateResult } from "lit";
import type { Plan } from "../app/floor-model/floor-model";
import type { RoomListItem } from "../domain/plan/room-list";
import type { Locale } from "../i18n/catalogs";
import { localize } from "../i18n/localize";
import { notice } from "./notice";
import { noFloorNotes, pictureOnlyNotes } from "./plan-notes";
import { roomSelectedEvent } from "./plan-picture";
import { settingsButton } from "./settings-button";

/** The room list: its buttons (`outlinedButtonStyles`) wrap on a narrow card. */
export const roomListStyles = css`
  .room-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ha-space-2, 8px);
    margin: var(--ha-space-2, 8px) 0 0;
    padding: 0;
    list-style: none;
  }
`;

/**
 * A plan without outlines that lists areas: one button per area, in model order, each firing `room-selected` (ADR 0005
 * « Room lists » item 1). `label` is the plan's accessible name: its floor, or its map and robot.
 */
export function roomList(plan: Plan, label: string, locale: Locale): TemplateResult | typeof nothing {
  const { content } = plan;
  if (content.kind !== "areas") return nothing;
  return html`<ul class="room-list" aria-label=${localize(locale, "plan.rooms", { name: label })}>
    ${content.items.map((item) => html`<li>${roomButton(plan.imageEntityId, item)}</li>`)}
  </ul>`;
}

function roomButton(imageEntityId: string, { areaId, name }: RoomListItem): TemplateResult {
  const select = (event: Event) =>
    event.currentTarget?.dispatchEvent(roomSelectedEvent({ kind: "area", imageEntityId, areaId }));
  return html`<button type="button" class="outlined-button" @click=${select}>${name}</button>`;
}

/** Whether a plan shows a room list or a note under its picture. */
export function hasPlanExtras(plan: Plan): boolean {
  return plan.content.kind !== "outlines" || plan.placement.kind === "no_floor";
}

/**
 * One note per plan: why its rooms cannot be started (ADR 0005 « Room lists » item 2), then why it is on no floor with
 * the Home Assistant fixes (« Map to floor » source 4), which a non-administrator asks an administrator to make (each
 * is a registry write). An administrator also gets a button to the vacuum's settings when its segment mapping is the
 * fix (ADR 0003 « Permissions »). `label` is the plan's name (its floor, or its map and robot). Nothing when it has
 * neither.
 */
export function planNote(plan: Plan, label: string, isAdmin: boolean, locale: Locale): TemplateResult | typeof nothing {
  const { content, placement } = plan;
  const { lines: why, vacuumSettings } =
    content.kind === "picture_only"
      ? pictureOnlyNotes(content.reason, isAdmin, locale)
      : { lines: [], vacuumSettings: false };
  const button = vacuumSettings
    ? html`<p class="notice-action">${settingsButton(plan.robot, localize(locale, "settings.open_vacuum"), label)}</p>`
    : nothing;
  const { fixes, facts } =
    placement.kind === "no_floor" ? noFloorNotes(placement.reasons, plan.mapName, locale) : { fixes: [], facts: [] };
  if (why.length + fixes.length + facts.length === 0) return nothing;
  return notice(
    "info",
    html`${why.map((line) => html`<p>${line}</p>`)}${button}${
      fixes.length === 0
        ? nothing
        : html`<p>${localize(locale, isAdmin ? "no_floor.lead" : "no_floor.lead_ask_admin")}</p>
            <ul>
              ${fixes.map((fix) => html`<li>${fix}</li>`)}
            </ul>`
    }${facts.map((fact) => html`<p>${fact}</p>`)}`,
  );
}
