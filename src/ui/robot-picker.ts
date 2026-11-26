import { html, LitElement, nothing, type TemplateResult } from "lit";
import type { Candidate } from "../app/robots-for-item/choice";
import type { ItemRef } from "../app/robots-for-item/robots-for-item";
import type { Locale } from "../i18n/catalogs";
import { localize } from "../i18n/localize";
import { noticeIcon, noticeLines } from "./notice";
import { type RobotNames, robotNameIn } from "./plan-display";
import { robotPickerStyles } from "./robot-picker.styles";
import { actionText, reasonText, robotState } from "./robot-words";
import { moreInfoEvent } from "./settings-button";

/** Custom element name of the robot picker's content. */
export const ROBOT_PICKER_ELEMENT = "vmc-robot-picker";

/** Fired by the picker when a startable robot is chosen. Nothing is sent: the confirmation comes next. */
export const ROBOT_CHOSEN_EVENT = "robot-chosen";

export interface RobotChosen {
  readonly item: ItemRef;
  readonly vacuumEntityId: string;
}

/**
 * The robots for one room or area (`docs/product.md` « Core flow » 3): each robot with what it would do and its state,
 * as a button when it can start, else as a disabled row that says why (« Honest state »). Every value shown is text.
 * Where it sits on screen belongs to its host (`vmc-picker-dialog`).
 */
export class RobotPicker extends LitElement {
  static override styles = robotPickerStyles;

  static override properties = {
    locale: { attribute: false },
    item: { attribute: false },
    itemName: { attribute: false },
    candidates: { attribute: false },
    robotNames: { attribute: false },
  };

  declare locale: Locale;
  /** The room or area the candidates were computed for, sent back with `robot-chosen`. */
  declare item: ItemRef | undefined;
  declare itemName: string;
  /** `robotsForItem`'s result, listed in its order. */
  declare candidates: readonly Candidate[];
  declare robotNames: RobotNames;

  constructor() {
    super();
    this.locale = "en";
    this.item = undefined;
    this.itemName = "";
    this.candidates = [];
    this.robotNames = new Map();
  }

  protected override render(): TemplateResult {
    const { candidates } = this;
    return html`<h2 id="heading" tabindex="-1">${this.itemName}</h2>
      ${
        candidates.length === 0
          ? html`<p class="empty">${localize(this.locale, "picker.empty")}</p>`
          : html`<ul class="robots" aria-labelledby="heading">
              ${candidates.map((candidate, index) => this.#row(candidate, `robot-${index}`))}
            </ul>`
      }`;
  }

  /** The focus for an opened picker: the first robot that can start, else the heading (#110). */
  focusFirst(): void {
    const first = this.renderRoot.querySelector("button.choose") ?? this.renderRoot.querySelector("h2");
    if (first instanceof HTMLElement) first.focus();
  }

  /** Every control, in focus order, so a host can keep Tab inside it. */
  controls(): HTMLButtonElement[] {
    return Array.from(this.renderRoot.querySelectorAll("button"));
  }

  /**
   * A robot that cannot start is a group named by the robot and marked `aria-disabled`, which leaves out its details
   * button: that one works. It says so in words, then why.
   */
  #row(candidate: Candidate, nameId: string): TemplateResult {
    const { choice, vacuumEntityId } = candidate;
    const name = robotNameIn(this.robotNames, vacuumEntityId);
    const details = this.#detailsButton(vacuumEntityId, name);
    if (choice.kind === "not_startable") {
      return html`<li>
        <div class="robot" role="group" aria-disabled="true" aria-labelledby=${nameId}>
          ${this.#summary(candidate, name, nameId)}
          <span class="cannot">${localize(this.locale, "picker.cannot_start")}</span>
          <div class="reasons">${noticeLines(choice.reasons.map((reason) => reasonText(this.locale, reason)))}</div>
        </div>
        ${details}
      </li>`;
    }
    const cleans =
      choice.kind === "path1" && choice.roomNames.length > 1
        ? html`<span class="cleans">${localize(this.locale, "picker.cleans", { names: choice.roomNames.join(", ") })}</span>`
        : nothing;
    return html`<li>
      <button type="button" class="robot choose outlined-button" @click=${() => this.#choose(vacuumEntityId)}>
        ${this.#summary(candidate, name)}${cleans}
      </button>
      ${details}
    </li>`;
  }

  /** The robot's name, then its action and its state: the state dot is decoration, its text says it. */
  #summary({ action, state }: Candidate, name: string, nameId?: string): TemplateResult {
    const words = robotState(this.locale, state);
    return html`<span class="name" id=${nameId ?? nothing}>${name}</span>
      <span class="line">
        <span class="action">${actionText(this.locale, action)}</span>
        <span class="status"><span class="dot ${words.tone}" aria-hidden="true"></span><span class="state">${words.text}</span></span>
      </span>`;
  }

  #detailsButton(entityId: string, name: string): TemplateResult {
    const label = localize(this.locale, "picker.details", { robot: name });
    return html`<button
      type="button"
      class="details icon-button"
      aria-label=${label}
      title=${label}
      @click=${() => this.#openDetails(entityId)}
    >
      ${noticeIcon("info")}
    </button>`;
  }

  #choose(vacuumEntityId: string): void {
    const { item } = this;
    if (!this.isConnected || item === undefined) return;
    const detail: RobotChosen = { item, vacuumEntityId };
    this.dispatchEvent(new CustomEvent(ROBOT_CHOSEN_EVENT, { detail }));
  }

  /** From the picker itself, which is connected, so the event crosses the shadow roots up to Home Assistant (§ 11). */
  #openDetails(entityId: string): void {
    if (!this.isConnected) return;
    this.dispatchEvent(moreInfoEvent(entityId));
  }
}
