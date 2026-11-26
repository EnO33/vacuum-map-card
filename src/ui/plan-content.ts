import { css, html, nothing, type TemplateResult } from "lit";
import type { Plan } from "../app/floor-model/floor-model";
import type { RoomListItem } from "../domain/plan/room-list";
import type { Locale } from "../i18n/catalogs";
import { localize } from "../i18n/localize";
import { notice } from "./notice";
import { noFloorNotes, pictureOnlyNotes } from "./plan-notes";
import { roomSelectedEvent } from "./plan-picture";

/** The room list's buttons: a 44 px touch target each, wrapping on a narrow card (ADR 0004 « Touch targets »). */
export const roomListStyles = css`
  .room-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ha-space-2, 8px);
    margin: var(--ha-space-2, 8px) 0 0;
    padding: 0;
    list-style: none;
  }
  .room-list button {
    box-sizing: border-box;
    min-width: 44px;
    min-height: 44px;
    padding: 0 var(--ha-space-4, 16px);
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    border-radius: var(--ha-border-radius-md, 8px);
    background: none;
    color: var(--primary-text-color, #141414);
    font: inherit;
    cursor: pointer;
  }
  .room-list button:hover {
    border-color: var(--primary-color, #03a9f4);
  }
  /*
   * The rooms' two-tone ring (ADR 0004 « Amendment (2026-11-25) » item 1), three 2 px bands: a card-coloured halo (the
   * outline's offset over a shadow), the focus colour, then a text-coloured line, so one band reaches 3:1 on any theme.
   * The outline alone stays in forced colours, where shadows are not drawn.
   */
  .room-list button:focus-visible {
    outline: 2px solid var(--ha-color-focus, var(--primary-color, #009ac7));
    outline-offset: 2px;
    box-shadow:
      0 0 0 2px var(--card-background-color, #fff),
      0 0 0 6px var(--primary-text-color, #212121);
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
  return html`<button type="button" @click=${select}>${name}</button>`;
}

/** Whether a plan shows a room list or a note under its picture. */
export function hasPlanExtras(plan: Plan): boolean {
  return plan.content.kind !== "outlines" || plan.placement.kind === "no_floor";
}

/**
 * One note per plan: why its rooms cannot be started (ADR 0005 « Room lists » item 2), then why it is on no floor with
 * the Home Assistant fixes (« Map to floor » source 4), which a non-administrator asks an administrator to make (each
 * is a registry write). Nothing when it has neither.
 */
export function planNote(plan: Plan, isAdmin: boolean, locale: Locale): TemplateResult | typeof nothing {
  const { content, placement } = plan;
  const why = content.kind === "picture_only" ? pictureOnlyNotes(content.reason, isAdmin, locale) : [];
  const { fixes, facts } =
    placement.kind === "no_floor" ? noFloorNotes(placement.reasons, plan.mapName, locale) : { fixes: [], facts: [] };
  if (why.length + fixes.length + facts.length === 0) return nothing;
  return notice(
    "info",
    html`${why.map((line) => html`<p>${line}</p>`)}${
      fixes.length === 0
        ? nothing
        : html`<p>${localize(locale, isAdmin ? "no_floor.lead" : "no_floor.lead_ask_admin")}</p>
            <ul>
              ${fixes.map((fix) => html`<li>${fix}</li>`)}
            </ul>`
    }${facts.map((fact) => html`<p>${fact}</p>`)}`,
  );
}
