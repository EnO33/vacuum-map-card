import { css, html, nothing, type TemplateResult } from "lit";
import type { Locale } from "../i18n/catalogs";
import { localize } from "../i18n/localize";
import type { CardView } from "./card-view";
import { floorLayout } from "./floor-layout";
import { planCount, shownPlans } from "./plan-display";
import { progressContext, progressList } from "./progress-list";
import { robotNotes } from "./robot-notes";
import { STATE_COLORS } from "./state-colors";

/** Styles of the card's body; the title keeps `ha-card`'s own header style. */
export const bodyStyles = css`
  /* Focused only by the card, when a dismissed entry has no room left to give the focus to. */
  .content:focus {
    outline: none;
  }
  .content {
    padding: 0 var(--ha-space-4, 16px) var(--ha-space-4, 16px);
    color: var(--primary-text-color, #141414);
  }
  [role="status"] p {
    margin: 0;
  }
  [role="status"] p + p {
    margin-top: var(--ha-space-2, 8px);
  }
  /* Read by a screen reader only: the same words show on the room and under its plan. */
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .secondary {
    color: var(--secondary-text-color, #5e5e5e);
  }
  .title {
    font-weight: var(--ha-font-weight-medium, 500);
  }
  /* ADR 0004 « State colours », Failed. On the edge, not the text: the text keeps its contrast and says it all. */
  .load-failed {
    border-inline-start: var(--ha-space-1, 4px) solid ${STATE_COLORS.error};
    padding-inline-start: var(--ha-space-3, 12px);
  }
`;

/**
 * The card's body for a view. The status region is the same element in every view, so a screen reader announces each
 * message that replaces the previous one (loading or « could not load », then no robot, error or no plan); the plans
 * stay outside it, followed by the progress of robots sent to a room no plan shows any more, then the notes on robots
 * whose rooms map adds no plan. `notice` is what the last start and the last progress change say, in the same region
 * so it is announced. Every value inserted is text, never markup.
 */
export function cardBody(
  view: CardView,
  locale: Locale,
  notice: TemplateResult | typeof nothing = nothing,
): TemplateResult {
  return html`<div role="status">${message(view, locale)}${notice}</div>
    ${
      view.kind === "ready"
        ? html`${planCount(view.model) > 0 ? floorLayout(view, locale) : nothing} ${unplacedProgress(view, locale)}
          ${robotNotes(view.model.robots, view.robotNames, locale)}`
        : nothing
    }`;
}

/** The progress of robots sent to an item of a plan the card no longer shows (re-mapping), so none is lost. */
function unplacedProgress(view: Extract<CardView, { kind: "ready" }>, locale: Locale): TemplateResult | typeof nothing {
  if (view.progress.length === 0) return nothing;
  const shown = new Set(shownPlans(view.model).map((plan) => plan.imageEntityId));
  const unplaced = view.progress.filter((entry) => !shown.has(entry.item.imageEntityId));
  return progressList(unplaced, localize(locale, "progress.list_unplaced"), progressContext(view, locale));
}

function message(view: CardView, locale: Locale): TemplateResult | typeof nothing {
  switch (view.kind) {
    case "loading":
      return html`<p class="secondary">${localize(locale, "card.loading")}</p>`;
    case "load_failed":
      // No detail of what failed: no error text, command, URL or token.
      return html`<div class="load-failed">
        <p class="title">${localize(locale, "card.load_failed")}</p>
        <p class="secondary">${localize(locale, "card.load_failed_hint")}</p>
      </div>`;
    case "failed":
      // No detail of what failed: no stack, URL, token or entity data.
      return html`<p>${localize(locale, "card.error")}</p>`;
    case "ready":
      if (view.model.robots.length === 0) return noRobot(view.integrations, locale);
      return html`${planCount(view.model) > 0 ? nothing : html`<p class="secondary">${localize(locale, "card.no_plan")}</p>`}
      ${view.gone === undefined ? nothing : html`<p>${localize(locale, "picker.gone", { name: view.gone })}</p>`}`;
  }
}

function noRobot(integrations: readonly string[], locale: Locale): TemplateResult {
  const integration = new Intl.ListFormat(locale, { type: "disjunction" }).format(integrations);
  return html`
    <p class="title">${localize(locale, "card.no_robot")}</p>
    <p class="secondary">${localize(locale, "card.no_robot_hint", { integration })}</p>
  `;
}
