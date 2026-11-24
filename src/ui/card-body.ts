import { css, html, nothing, type TemplateResult } from "lit";
import type { Locale } from "../i18n/catalogs";
import { localize } from "../i18n/localize";
import type { CardView } from "./card-session";

/** Styles of the card's body; the title keeps `ha-card`'s own header style. */
export const bodyStyles = css`
  .content {
    padding: 0 var(--ha-space-4, 16px) var(--ha-space-4, 16px);
    color: var(--primary-text-color);
  }
  .content p {
    margin: 0;
  }
  .content p + p {
    margin-top: var(--ha-space-2, 8px);
  }
  .secondary {
    color: var(--secondary-text-color);
  }
  .title {
    font-weight: var(--ha-font-weight-medium, 500);
  }
  /* ADR 0004 « State colours », Failed. On the edge, not the text: the text keeps its contrast and says it all. */
  .load-failed {
    border-inline-start: var(--ha-space-1, 4px) solid
      var(--state-vacuum-error-color, var(--state-vacuum-active-color, var(--state-active-color)));
    padding-inline-start: var(--ha-space-3, 12px);
  }
  ul {
    margin: 0;
    padding-inline-start: var(--ha-space-6, 24px);
  }
`;

/**
 * The card's body for a view. The status region is the same element in every view, so a screen reader announces each
 * message that replaces the previous one (loading or « could not load », then no robot, error or no plan); the floor list stays outside it.
 * Every value inserted is text, never markup.
 */
export function cardBody(view: CardView, locale: Locale): TemplateResult {
  const names = view.kind === "ready" && view.model.robots.length > 0 ? floorNames(view, locale) : [];
  return html`<div role="status">${message(view, names, locale)}</div>
    ${
      names.length === 0
        ? nothing
        : html`<ul>
          ${names.map((name) => html`<li>${name}</li>`)}
        </ul>`
    }`;
}

/** A temporary summary: the floor names, then the « no floor » group; the layout issue replaces it with the plans. */
function floorNames(view: Extract<CardView, { kind: "ready" }>, locale: Locale): string[] {
  const names = view.model.floors.map((floor) => floor.name);
  if (view.model.noFloor.length > 0) names.push(localize(locale, "card.no_floor"));
  return names;
}

function message(view: CardView, names: readonly string[], locale: Locale): TemplateResult | typeof nothing {
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
      return names.length === 0 ? html`<p class="secondary">${localize(locale, "card.no_plan")}</p>` : nothing;
  }
}

function noRobot(integrations: readonly string[], locale: Locale): TemplateResult {
  const integration = new Intl.ListFormat(locale, { type: "disjunction" }).format(integrations);
  return html`
    <p class="title">${localize(locale, "card.no_robot")}</p>
    <p class="secondary">${localize(locale, "card.no_robot_hint", { integration })}</p>
  `;
}
