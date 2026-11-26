import { css, html, nothing, type TemplateResult } from "lit";
import type { Locale, MessageKey } from "../i18n/catalogs";
import { localize } from "../i18n/localize";
import { settingsButton } from "./settings-button";

/** The steps in Home Assistant's own words (en and fr, `docs/research/ha-frontend.md` § 14), one item each. */
const ENABLE_STEPS: readonly MessageKey[] = [
  "plan.enable_step_find",
  "plan.enable_step_open",
  "plan.enable_step_enable",
];

/** The message box (`planMessageStyles`) holding a list and a button: read from the start, spaced like a notice. */
export const disabledPlanStyles = css`
  /* An entity id is one long word: it wraps instead of leaving the box on a phone. */
  .disabled-plan {
    text-align: start;
    overflow-wrap: anywhere;
  }
  .disabled-plan p,
  .disabled-plan ol {
    margin: 0;
  }
  .disabled-plan > * + * {
    margin-top: var(--ha-space-2, 8px);
  }
  .disabled-plan > p:first-child {
    color: var(--primary-text-color, #141414);
  }
  .disabled-plan ol {
    padding-inline-start: var(--ha-space-5, 20px);
  }
`;

/**
 * In place of a disabled floor plan's picture (ADR 0005 « Plan pictures » item 5): that it is turned off, then for an
 * administrator a button to the entity's settings, the quickest way, and for every user the steps to enable it, which
 * a non-administrator asks an administrator to follow. The card never enables it. Every value is text.
 */
export function disabledPlan(
  imageEntityId: string,
  isAdmin: boolean,
  planName: string,
  locale: Locale,
): TemplateResult {
  return html`<div class="plan-message disabled-plan">
    <p>${localize(locale, "plan.disabled")}</p>
    ${isAdmin ? html`<p>${settingsButton(imageEntityId, localize(locale, "settings.open"), planName)}</p>` : nothing}
    <p>${localize(locale, isAdmin ? "plan.enable_lead" : "plan.enable_lead_ask_admin")}</p>
    <ol>
      ${ENABLE_STEPS.map((key) => html`<li>${localize(locale, key, { entity: imageEntityId })}</li>`)}
    </ol>
  </div>`;
}
