import { css, html, LitElement } from "lit";
import { CARD_NAME } from "./card-meta";

export class VacuumMapCard extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
  `;

  /** Home Assistant state, set on every change in the home. Not used yet, so it does not re-render. */
  hass: unknown;

  #config: unknown;

  /** Raw dashboard configuration: untrusted until a parser exists (card options, Epic 5). */
  get config(): unknown {
    return this.#config;
  }

  /** Required by Home Assistant: called when the card is created and when its configuration changes. */
  setConfig(config: unknown): void {
    this.#config = config;
  }

  // The title is a light-DOM child of ha-card, so it stays readable when ha-card is not defined.
  // Do not style `.card-header` or `h1` here: these styles would override ha-card's native slotted header style.
  protected override render() {
    return html`<ha-card><h1 class="card-header">${CARD_NAME}</h1></ha-card>`;
  }
}
