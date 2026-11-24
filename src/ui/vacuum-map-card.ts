import { css, html, LitElement, type TemplateResult } from "lit";
import { createAdapters } from "../adapters/create-adapters";
import { createFloorModelBuilder } from "../app/floor-model/memo";
import { bodyStyles, cardBody } from "./card-body";
import { CARD_NAME } from "./card-meta";
import { CardSession, type CardView, type SessionDependencies } from "./card-session";

const FAILED: CardView = Object.freeze({ kind: "failed" });

const REAL_DEPENDENCIES: SessionDependencies = Object.freeze({
  createAdapters,
  createModelBuilder: createFloorModelBuilder,
});

export class VacuumMapCard extends LitElement {
  static override styles = [
    css`
      :host {
        display: block;
      }
    `,
    bodyStyles,
  ];

  #hass: unknown;
  #config: unknown;
  readonly #session = new CardSession(
    () => this.sessionDependencies(),
    () => this.requestUpdate(),
  );

  /**
   * Home Assistant state, set on every change in the home (`docs/research/ha-frontend.md` « Facts the card relies
   * on »). Not a reactive property: the card renders only when what it shows changes.
   */
  get hass(): unknown {
    return this.#hass;
  }

  set hass(value: unknown) {
    this.#hass = value;
    this.#session.setHass(value);
  }

  /** Raw dashboard configuration: untrusted until a parser exists (card options, #115). */
  get config(): unknown {
    return this.#config;
  }

  /** Required by Home Assistant: called when the card is created and when its configuration changes. */
  setConfig(config: unknown): void {
    this.#config = config;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#session.connect();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#session.disconnect();
  }

  /** What each attachment makes: the real adapters and model builder; a test subclass replaces them. */
  protected sessionDependencies(): SessionDependencies {
    return REAL_DEPENDENCIES;
  }

  // The title is a light-DOM child of ha-card, so it stays readable when ha-card is not defined.
  // Do not style `.card-header` or `h1` here: these styles would override ha-card's native slotted header style.
  protected override render(): TemplateResult {
    return html`<ha-card><h1 class="card-header">${CARD_NAME}</h1><div class="content">${this.#body()}</div></ha-card>`;
  }

  #body(): TemplateResult {
    const { locale, view } = this.#session.state;
    try {
      return cardBody(view, locale);
    } catch {
      // The same template, so the status region stays the same element and announces the error.
      return cardBody(FAILED, locale);
    }
  }
}
