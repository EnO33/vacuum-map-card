// A minimal stand-in for Home Assistant's `ha-card`, so the card looks on the demo page as it does on a dashboard.
// Its styles are the frontend's at 20261028.6 (`src/components/ha-card.ts` L11-L52, Apache-2.0), without the
// `raised` variant and the `header` property, which the card does not use, and without the transition, so a
// screenshot taken right after a theme switch is settled. Licence: `ha-card.LICENSE.md`.
import { css, html, LitElement, type TemplateResult } from "lit";
import { defineOnce } from "../src/ui/register";

class DemoHaCard extends LitElement {
  static override styles = css`
    :host {
      background: var(--ha-card-background, var(--card-background-color, white));
      box-shadow: var(--ha-card-box-shadow, none);
      box-sizing: border-box;
      border-radius: var(--ha-card-border-radius, var(--ha-border-radius-lg));
      border-width: var(--ha-card-border-width, 1px);
      border-style: solid;
      border-color: var(--ha-card-border-color, var(--divider-color, #e0e0e0));
      color: var(--primary-text-color);
      display: block;
      position: relative;
    }
    :host ::slotted(.card-header) {
      color: var(--ha-card-header-color, var(--primary-text-color));
      font-family: var(--ha-card-header-font-family, inherit);
      font-size: var(--ha-card-header-font-size, var(--ha-font-size-2xl));
      letter-spacing: -0.012em;
      line-height: var(--ha-line-height-condensed);
      padding: var(--ha-space-5) var(--ha-space-4) var(--ha-space-6);
      display: block;
      margin-block-start: 0;
      margin-block-end: 0;
      font-weight: var(--ha-font-weight-normal);
    }
  `;

  protected override render(): TemplateResult {
    return html`<slot></slot>`;
  }
}

/** Defines the stand-in unless a real `ha-card` is already defined. */
export function defineHaCard(): void {
  defineOnce(customElements, "ha-card", DemoHaCard);
}
