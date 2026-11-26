import { css, html, LitElement, nothing, type TemplateResult } from "lit";
import { createAdapters } from "../adapters/create-adapters";
import { createFloorModelBuilder } from "../app/floor-model/memo";
import { bodyStyles, cardBody } from "./card-body";
import { CARD_NAME } from "./card-meta";
import { CardSession, type CardView, type SessionDependencies } from "./card-session";
import { cardSize } from "./card-size";
import { disabledPlanStyles } from "./disabled-plan";
import { layoutStyles } from "./floor-layout";
import { noticeStyles } from "./notice";
import { outlinedButtonStyles } from "./outlined-button";
import { roomListStyles } from "./plan-content";
import { planMessageStyles } from "./plan-picture";
import { RoomSelectedEvent } from "./room-selected";

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
      /*
       * A sections grid sizes the cell: the card fills it (docs/research/ha-frontend.md § 7), and the plans scroll
       * inside it when the user sets fewer rows than they need.
       */
      :host([layout="grid"]),
      :host([layout="grid"]) ha-card {
        height: 100%;
      }
      :host([layout="grid"]) ha-card {
        display: flex;
        flex-direction: column;
      }
      :host([layout="grid"]) .content {
        flex: 1;
        min-height: 0;
        overflow: auto;
      }
      .picker {
        margin-top: var(--ha-space-4, 16px);
      }
    `,
    bodyStyles,
    layoutStyles,
    planMessageStyles,
    noticeStyles,
    roomListStyles,
    outlinedButtonStyles,
    disabledPlanStyles,
  ];

  static override properties = { layout: { reflect: true } };

  /**
   * Set by Home Assistant: `"grid"` in a sections view (the card fills its cell), `"panel"` in a panel view, unset in
   * masonry. Any value but `"grid"` lets the height follow the content.
   */
  declare layout: string | undefined;

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

  /**
   * Read by a sections view (`LovelaceGridOptions`, `docs/research/ha-frontend.md` § 7): the section's full width so
   * plans can sit side by side, the content's height, and at least half the section so a plan stays readable. A new
   * object on each call; the user's `grid_options` override it.
   */
  getGridOptions(): { columns: number; rows: "auto"; min_columns: number } {
    return { columns: 12, rows: "auto", min_columns: 6 };
  }

  /** Read by a masonry view, in 50 px units; synchronous so Home Assistant never waits for it. */
  getCardSize(): number {
    return cardSize(this.#session.state.view);
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
    return html`<ha-card
      ><h1 class="card-header">${CARD_NAME}</h1>
      <div class="content" @room-selected=${this.#onRoomSelected}>${this.#body()}${this.#picker()}</div></ha-card
    >`;
  }

  /**
   * `vmc-robot-picker` (`ROBOT_PICKER_ELEMENT`), shown under the plans for now: placing it next to the room, and its focus, come with #110. Choosing a robot does
   * nothing yet (the confirmation issues).
   */
  #picker(): TemplateResult | typeof nothing {
    const { locale, view } = this.#session.state;
    if (view.kind !== "ready" || view.picked === undefined) return nothing;
    const { picked } = view;
    return html`<vmc-robot-picker
      class="picker"
      .locale=${locale}
      .item=${picked.item}
      .itemName=${picked.name}
      .candidates=${picked.candidates}
      .robotNames=${view.robotNames}
    ></vmc-robot-picker>`;
  }

  readonly #onRoomSelected = (event: Event): void => {
    if (event instanceof RoomSelectedEvent) this.#session.select(event.detail);
  };

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
