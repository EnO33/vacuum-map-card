import { css, html, nothing, type TemplateResult } from "lit";
import type { Plan } from "../app/floor-model/floor-model";
import type { ProgressEntry } from "../app/progress/progress-tracker";
import type { RoomListItem } from "../domain/plan/room-list";
import type { Locale } from "../i18n/catalogs";
import { localize } from "../i18n/localize";
import { entriesOnArea, itemProgress } from "./item-progress";
import { notice } from "./notice";
import { noFloorNotes, pictureOnlyNotes } from "./plan-notes";
import type { ProgressContext } from "./progress-list";
import { progressIcon, toneClasses } from "./progress-marks";
import { roomSelectedEvent } from "./room-selected";
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
  /* A started area: its phase's colour on the edge, its icon and label in the button (ADR 0004 « State colours »). */
  .room-list .filled {
    border-width: 2px;
    border-color: var(--progress-color);
  }
  .room-list button:has(.room-badge) {
    padding-block: var(--ha-space-2, 8px);
  }
  .room-badge {
    display: inline-flex;
    gap: var(--ha-space-1, 4px);
    align-items: center;
    margin-inline-start: var(--ha-space-2, 8px);
    color: var(--secondary-text-color, #5e5e5e);
    font-size: var(--ha-font-size-s, 12px);
    vertical-align: middle;
  }
  .room-badge .progress-icon {
    width: 18px;
    height: 18px;
    color: var(--progress-color, var(--secondary-text-color, #5e5e5e));
  }
`;

/**
 * A plan without outlines that lists areas: one button per area, in model order, each firing `room-selected` (ADR 0005
 * « Room lists » item 1). `label` is the plan's accessible name: its floor, or its map and robot. An area a robot was
 * sent to shows its phase (`entries`: the progress on this plan).
 */
export function roomList(
  plan: Pick<Plan, "imageEntityId" | "content">,
  label: string,
  entries: readonly ProgressEntry[],
  context: Pick<ProgressContext, "locale" | "robotName">,
): TemplateResult | typeof nothing {
  const { content } = plan;
  if (content.kind !== "areas") return nothing;
  return html`<ul class="room-list" aria-label=${localize(context.locale, "plan.rooms", { name: label })}>
    ${content.items.map((item) => html`<li>${roomButton(plan.imageEntityId, item, entries, context)}</li>`)}
  </ul>`;
}

function roomButton(
  imageEntityId: string,
  { areaId, name }: RoomListItem,
  entries: readonly ProgressEntry[],
  { locale, robotName }: Pick<ProgressContext, "locale" | "robotName">,
): TemplateResult {
  const select = (event: Event) => {
    const button = event.currentTarget;
    if (button instanceof HTMLElement)
      button.dispatchEvent(roomSelectedEvent({ kind: "area", imageEntityId, areaId }, button));
  };
  const progress = itemProgress(locale, name, entriesOnArea(entries, areaId), robotName);
  if (progress === undefined)
    return html`<button type="button" class="outlined-button" @click=${select}>${name}</button>`;
  return html`<button
    type="button"
    class=${["outlined-button", toneClasses(progress.tone)].filter(Boolean).join(" ")}
    aria-label=${progress.name}
    @click=${select}
  >
    ${name}<span class="room-badge">${progressIcon(progress.entry)}${progress.label}</span>
  </button>`;
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
