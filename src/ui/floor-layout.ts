import { css, html, nothing, type TemplateResult } from "lit";
import type { Plan } from "../app/floor-model/floor-model";
import { registryNameKey } from "../domain/text/registry-name";
import type { Locale } from "../i18n/catalogs";
import { localize } from "../i18n/localize";
import type { CardView } from "./card-session";
import type { PlanDisplay } from "./plan-display";
import { planMessage } from "./plan-picture";

type ReadyView = Extract<CardView, { kind: "ready" }>;

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
  .plans + .no-floor {
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
  figcaption {
    margin-top: var(--ha-space-1, 4px);
    color: var(--secondary-text-color, #5e5e5e);
  }
`;

/** Each floor's section in model order, then the « no floor » group when it has plans. Every value is text. */
export function floorLayout(view: ReadyView, locale: Locale): TemplateResult {
  const { floors, noFloor } = view.model;
  const figure = (plan: Plan, floorName?: string) =>
    planFigure(plan, view.plans.get(plan.imageEntityId), locale, floorName);
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
 * maps can be told apart. The picture's alt names its floor, or its map and robot in the « no floor » group.
 */
function planFigure(plan: Plan, display: PlanDisplay | undefined, locale: Locale, floorName?: string): TemplateResult {
  const map = mapLabel(plan, locale);
  const robot = display?.robotName ?? plan.robot;
  const alt =
    floorName === undefined
      ? localize(locale, "plan.alt_no_floor", { map, robot })
      : localize(locale, "plan.alt", { name: floorName });
  const sameAsFloor = floorName !== undefined && registryNameKey(map) === registryNameKey(floorName);
  return html`<figure>
    ${picture(plan, display?.url, alt, locale)}
    <figcaption>${sameAsFloor ? nothing : html`${map} <span aria-hidden="true">·</span> `}${robot}</figcaption>
  </figure>`;
}

/** The picture, or a readable message for each state that has none (ADR 0005 « Plan pictures » item 3). */
function picture(plan: Plan, url: string | undefined, alt: string, locale: Locale): TemplateResult {
  if (plan.pictureState !== "available") return planMessage(localize(locale, `plan.${plan.pictureState}`));
  if (url === undefined) return planMessage(localize(locale, "plan.no_picture"));
  return html`<vmc-plan-picture .src=${url} .alt=${alt} .locale=${locale}></vmc-plan-picture>`;
}
