import { css, html, nothing, type TemplateResult } from "lit";
import type { Plan } from "../app/floor-model/floor-model";
import type { ProgressEntry } from "../app/progress/progress-tracker";
import { type RoomsPlan, undrawableRooms } from "../domain/plan/rooms-plan";
import { registryNameKey } from "../domain/text/registry-name";
import type { Locale } from "../i18n/catalogs";
import { localize } from "../i18n/localize";
import type { ReadyView } from "./card-view";
import { disabledPlan } from "./disabled-plan";
import { entriesOnPlan } from "./item-progress";
import { planNote, roomList } from "./plan-content";
import { robotNameIn } from "./plan-display";
import { planMessage } from "./plan-picture";
import { type ProgressContext, progressContext, progressList } from "./progress-list";

/**
 * The plans' layout follows the card's own width (container query), never the viewport's: a card can be narrow on a
 * wide screen. A plan is at least 280 px wide, about a phone card's content: plans stack below two of them and the gap
 * (576 px; a container query cannot read a theme variable), and sit side by side above, three on a wide card.
 */
export const layoutStyles = css`
  .content {
    container-type: inline-size;
  }
  .plans {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--ha-space-4, 16px);
  }
  @container (min-width: 576px) {
    .plans {
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    }
  }
  .plans + .no-floor,
  .robot-notes {
    margin-top: var(--ha-space-6, 24px);
  }
  h2 {
    margin: 0 0 var(--ha-space-2, 8px);
    font-size: var(--ha-font-size-l, 16px);
    font-weight: var(--ha-font-weight-medium, 500);
    line-height: var(--ha-line-height-condensed, 1.2);
  }
  figure {
    margin: 0;
  }
  figcaption,
  .not-drawn {
    margin-top: var(--ha-space-1, 4px);
    color: var(--secondary-text-color, #5e5e5e);
  }
  .not-drawn {
    margin-bottom: 0;
  }
`;

/** Each floor's section in model order, then the « no floor » group when it has plans. Every value is text. */
export function floorLayout(view: ReadyView, locale: Locale): TemplateResult {
  const { floors, noFloor } = view.model;
  const context = progressContext(view, locale);
  const figure = (plan: Plan, floorName?: string) => planFigure(plan, view, context, floorName);
  return html`${
    floors.length === 0
      ? nothing
      : html`<div class="plans">
          ${floors.map(
            (floor) => html`<section>
              <h2>${floor.name}</h2>
              ${figure(floor.plan, floor.name)}
            </section>`,
          )}
        </div>`
  }
  ${
    noFloor.length === 0
      ? nothing
      : html`<section class="no-floor">
          <h2>${localize(locale, "card.no_floor")}</h2>
          <div class="plans">${noFloor.map((plan) => figure(plan))}</div>
        </section>`
  }`;
}

/** The map's own name, « Map n » by its place in the robot's stored maps, or « Current map »: never the map id. */
function mapLabel(plan: Plan, locale: Locale): string {
  if (plan.mapName !== undefined) return plan.mapName;
  if (plan.mapNumber === undefined) return localize(locale, "plan.current_map");
  return localize(locale, "plan.generic_name", { number: String(plan.mapNumber) });
}

/**
 * A plan with its label: the map, left out on its floor when it has the floor's name, and the robot, so two robots'
 * maps can be told apart. The picture's alt names its floor, or its map and robot in the « no floor » group. Under it
 * come its room list or why it has none, and why it is on no floor.
 */
function planFigure(plan: Plan, view: ReadyView, context: ProgressContext, floorName?: string): TemplateResult {
  const { locale } = context;
  const map = mapLabel(plan, locale);
  const robot = robotNameIn(view.robotNames, plan.robot);
  const url = view.plans.get(plan.imageEntityId)?.url;
  const rooms = plan.content.kind === "outlines" ? plan.content.plan : undefined;
  const picked = view.picked?.item;
  const selected = picked?.kind === "room" && picked.imageEntityId === plan.imageEntityId ? picked.regionId : undefined;
  // The note speaks of the picture's rooms: only under a picture that is shown.
  const shown = plan.pictureState === "available" && url !== undefined;
  const alt =
    floorName === undefined
      ? localize(locale, "plan.alt_no_floor", { map, robot })
      : localize(locale, "plan.alt", { name: floorName });
  const sameAsFloor = floorName !== undefined && registryNameKey(map) === registryNameKey(floorName);
  const label = floorName ?? `${map}, ${robot}`;
  const progress = entriesOnPlan(view.progress, plan.imageEntityId);
  return html`<div class="plan">
    <figure>
      ${picture(plan, url, { alt, label }, { rooms, selected, progress }, view, locale)}
      <figcaption>${sameAsFloor ? nothing : html`${map} <span aria-hidden="true">·</span> `}${robot}</figcaption>
    </figure>
    ${shown ? notDrawn(rooms, locale) : nothing} ${roomList(plan, label, progress, context)}
    ${planNote(plan, label, view.isAdmin, locale)} ${progressList(progress, localize(locale, "progress.list", { name: label }), context)}
  </div>`;
}

/**
 * The picture, or a readable message for each state that has none (ADR 0005 « Plan pictures » item 3); a disabled one
 * comes with the steps to enable it (item 5).
 */
function picture(
  plan: Plan,
  url: string | undefined,
  names: { readonly alt: string; readonly label: string },
  layer: {
    readonly rooms: RoomsPlan | undefined;
    readonly selected: string | undefined;
    readonly progress: readonly ProgressEntry[];
  },
  view: ReadyView,
  locale: Locale,
): TemplateResult {
  if (plan.pictureState === "disabled") return disabledPlan(plan.imageEntityId, view.isAdmin, names.label, locale);
  if (plan.pictureState !== "available") return planMessage(localize(locale, `plan.${plan.pictureState}`));
  if (url === undefined) return planMessage(localize(locale, "plan.no_picture"));
  return html`<vmc-plan-picture
    .src=${url}
    .alt=${names.alt}
    .locale=${locale}
    .rooms=${layer.rooms}
    .selected=${layer.selected}
    .imageEntityId=${plan.imageEntityId}
    .label=${names.label}
    .progress=${layer.progress}
    .robotNames=${view.robotNames}
  ></vmc-plan-picture>`;
}

/** The rooms of an outlines plan that cannot be drawn, named so none silently disappears. */
function notDrawn(rooms: RoomsPlan | undefined, locale: Locale): TemplateResult | typeof nothing {
  const names = rooms ? undrawableRooms(rooms).map((room) => room.name) : [];
  if (names.length === 0) return nothing;
  const list = new Intl.ListFormat(locale, { type: "conjunction" }).format(names);
  return html`<p class="not-drawn">${localize(locale, "plan.not_drawn", { names: list })}</p>`;
}
