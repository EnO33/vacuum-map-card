import { css, html, LitElement, nothing, type TemplateResult } from "lit";
import { createAdapters } from "../adapters/create-adapters";
import { type CardConfig, NO_OPTIONS, parseConfig } from "../app/config/card-config";
import { createFloorModelBuilder } from "../app/floor-model/memo";
import { bodyStyles, cardBody } from "./card-body";
import { CardSession, type SessionDependencies } from "./card-session";
import { cardSize } from "./card-size";
import { CardStart } from "./card-start";
import { FAILED } from "./card-view";
import { CONFIRM_DIALOG_ELEMENT, ConfirmDialog } from "./confirm-dialog";
import { disabledPlanStyles } from "./disabled-plan";
import { layoutStyles } from "./floor-layout";
import type { Focusable } from "./focus";
import { noticeStyles } from "./notice";
import { outlinedButtonStyles } from "./outlined-button";
import { PICKER_DIALOG_ELEMENT, PickerDialog } from "./picker-dialog";
import { roomListStyles } from "./plan-content";
import { robotNameIn, shownPlans } from "./plan-display";
import { planMessageStyles } from "./plan-picture";
import { onDismissed, ProgressDismissedEvent, progressListStyles } from "./progress-list";
import { progressToneStyles } from "./progress-marks";
import { RobotChosenEvent } from "./robot-picker";
import { RoomSelectedEvent } from "./room-selected";
import { StatusLine } from "./status-line";

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
    `,
    bodyStyles,
    layoutStyles,
    planMessageStyles,
    noticeStyles,
    roomListStyles,
    outlinedButtonStyles,
    disabledPlanStyles,
    progressToneStyles,
    progressListStyles,
  ];

  static override properties = { layout: { reflect: true } };

  /**
   * Set by Home Assistant: `"grid"` in a sections view (the card fills its cell), `"panel"` in a panel view, unset in
   * masonry. Any value but `"grid"` lets the height follow the content.
   */
  declare layout: string | undefined;

  /**
   * Set by Home Assistant to `true` while the card is shown in the card editor (`docs/research/ha-frontend.md` § 7):
   * the card then never starts a robot (ADR 0003 « Amendment (2026-11-24) », item 6).
   */
  preview: unknown = false;

  #hass: unknown;
  #config: CardConfig = NO_OPTIONS;
  /** The room or list button of the last selection: the picker's anchor and focus return. */
  #opener: Focusable | undefined;
  /** The status region's words beyond the view's: the last start's notice and the last progress change. */
  readonly #status = new StatusLine();
  readonly #session = new CardSession(
    () => this.sessionDependencies(),
    () => this.requestUpdate(),
  );
  readonly #start = new CardStart({
    element: this,
    locale: () => this.#session.state.locale,
    robotName: (id) => this.#robotName(id),
    preview: () => this.preview === true,
    controller: () => this.#session.controller,
    ownDialog: () => {
      const found = this.renderRoot.querySelector(CONFIRM_DIALOG_ELEMENT);
      return found instanceof ConfirmDialog ? found : undefined;
    },
    closePicker: () => this.#closePicker(),
    show: (notice) => {
      this.#status.show(notice);
      this.requestUpdate();
    },
  });

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

  /**
   * Read by the card picker for a new card (`docs/research/ha-frontend.md` § 8): no option, everything is discovered.
   */
  static getStubConfig(): Record<string, never> {
    return {};
  }

  /** The parsed options. */
  get config(): CardConfig {
    return this.#config;
  }

  /**
   * Required by Home Assistant: called when the card is created and when its configuration changes. A wrong
   * configuration throws, and Home Assistant shows the message instead of the card.
   */
  setConfig(config: unknown): void {
    this.#config = parseConfig(config);
    this.#session.setConfig(this.#config);
    this.requestUpdate();
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
    return cardSize(this.#session.state.view, this.#config.title !== undefined);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#session.connect();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#start.abort();
    this.#status.forget();
    this.#session.disconnect();
  }

  /** What each attachment makes: the real adapters and model builder; a test subclass replaces them. */
  protected sessionDependencies(): SessionDependencies {
    return REAL_DEPENDENCIES;
  }

  protected override willUpdate(): void {
    this.#status.update(this.#session.state.view);
  }

  // The title, as text, is a light-DOM child of ha-card, so it stays readable when ha-card is not defined.
  // Do not style `.card-header` or `h1` here: these styles would override ha-card's native slotted header style.
  protected override render(): TemplateResult {
    const { title } = this.#config;
    const header = title === undefined ? nothing : html`<h1 class="card-header">${title}</h1>`;
    return html`<ha-card
      >${header}
      <div
        class="content"
        tabindex="-1"
        @room-selected=${this.#onRoomSelected}
        @progress-dismissed=${this.#onProgressDismissed}
      >
        ${this.#body()}
      </div>
      ${this.#picker()}<vmc-confirm-dialog .locale=${this.#session.state.locale}></vmc-confirm-dialog></ha-card
    >`;
  }

  /**
   * `vmc-picker-dialog` (`PICKER_DIALOG_ELEMENT`), open while an item is selected: a popover next to the room or a
   * bottom sheet (ADR 0004 « Robot picker »). Choosing a robot closes it and asks for confirmation.
   */
  #picker(): TemplateResult | typeof nothing {
    const { locale, view } = this.#session.state;
    if (view.kind !== "ready") return nothing;
    return html`<vmc-picker-dialog
      .locale=${locale}
      .picked=${view.picked}
      .robotNames=${view.robotNames}
      .opener=${this.#opener}
      @picker-closed=${this.#onPickerClosed}
      @robot-chosen=${this.#onRobotChosen}
    ></vmc-picker-dialog>`;
  }

  readonly #onRoomSelected = (event: Event): void => {
    if (!(event instanceof RoomSelectedEvent)) return;
    this.#opener = event.opener;
    this.#session.select(event.detail);
  };

  readonly #onRobotChosen = (event: Event): void => {
    if (!(event instanceof RobotChosenEvent)) return;
    const { view } = this.#session.state;
    const itemName = view.kind === "ready" ? (view.picked?.name ?? "") : "";
    void this.#start.choose(event.detail, itemName, this.#opener);
  };

  /** Ends the selection and waits for the picker to close, so one Escape never closes two layers. */
  async #closePicker(): Promise<void> {
    this.#session.deselect();
    await this.updateComplete;
    const picker = this.renderRoot.querySelector(PICKER_DIALOG_ELEMENT);
    if (picker instanceof PickerDialog) await picker.updateComplete;
  }

  /** A robot's name as the card shows it. */
  #robotName(vacuumEntityId: string): string {
    const { view } = this.#session.state;
    return view.kind === "ready" ? robotNameIn(view.robotNames, vacuumEntityId) : vacuumEntityId;
  }

  readonly #onProgressDismissed = (event: Event): void => {
    if (!(event instanceof ProgressDismissedEvent)) return;
    void onDismissed(event, {
      dismiss: (id) => this.#session.dismiss(id),
      rendered: () => this.updateComplete,
      plans: () => {
        const { view } = this.#session.state;
        return view.kind === "ready" ? shownPlans(view.model) : undefined;
      },
      fallback: () => this.renderRoot.querySelector<HTMLElement>(".content")?.focus(),
    });
  };

  readonly #onPickerClosed = (): void => {
    this.#session.deselect();
  };

  #body(): TemplateResult {
    const { locale, view } = this.#session.state;
    try {
      return cardBody(
        view,
        locale,
        this.#status.view(locale, (id) => this.#robotName(id)),
      );
    } catch {
      // The same template, so the status region stays the same element and announces the error.
      return cardBody(FAILED, locale);
    }
  }
}
