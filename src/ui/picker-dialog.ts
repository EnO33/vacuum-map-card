import { html, LitElement, type PropertyValues, svg, type TemplateResult } from "lit";
import { sameValue } from "../app/floor-model/same-value";
import type { Locale } from "../i18n/catalogs";
import { localize } from "../i18n/localize";
import type { PickedItem } from "./card-view";
import { deepActiveElement, type Focusable } from "./focus";
import { isRepeatedActivation } from "./key-repeat";
import { pickerDialogStyles } from "./picker-dialog.styles";
import type { RobotNames } from "./plan-display";
import { popoverPlace } from "./popover-place";
import { RobotChosenEvent, RobotPicker } from "./robot-picker";

/** Custom element name of the robot picker's window. */
export const PICKER_DIALOG_ELEMENT = "vmc-picker-dialog";

/** Fired when the picker closes without a choice (Escape, outside click, close button, leaving the page). */
export const PICKER_CLOSED_EVENT = "picker-closed";

/** Home Assistant's adaptive dialog breakpoint: a bottom sheet when it matches (ADR 0004 « Robot picker »). */
export const NARROW_QUERY = "(max-width: 870px), (max-height: 500px)";

const CLOSE_ICON = svg`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>`;

/**
 * The robot picker's window: a card-owned `<dialog>` opened with `showModal()`, so it sits in the top layer and no
 * ancestor clips it (sections, transforms, the editor preview; `docs/research/ha-frontend.md` § 13). Wide, it is a
 * popover next to the room that opened it; narrow, a bottom sheet over a scrim. It opens while `picked` is set and
 * closes when it is cleared. On open the focus goes to the first robot that can start; Tab stays inside; Escape, the
 * scrim and the close button close it and fire {@link PICKER_CLOSED_EVENT}, as leaving the page does. Every close
 * gives the focus back to the opener.
 */
export class PickerDialog extends LitElement {
  static override styles = pickerDialogStyles;

  static override properties = {
    locale: { attribute: false },
    picked: { attribute: false },
    robotNames: { attribute: false },
    opener: { attribute: false },
  };

  declare locale: Locale;
  declare picked: PickedItem | undefined;
  declare robotNames: RobotNames;
  /** The room or list button that opened the picker: its anchor, and where the focus goes back. */
  declare opener: Focusable | undefined;

  #media: MediaQueryList | undefined;
  /** Where the focus goes back: the opener while the picker is open, kept after the card lets go of it. */
  #returnTo: Focusable | undefined;
  /** Whether the pointer went down on the scrim: a click closes only when it also started there. */
  #downOnScrim = false;

  constructor() {
    super();
    this.locale = "en";
    this.picked = undefined;
    this.robotNames = new Map();
    this.opener = undefined;
  }

  get #dialog(): HTMLDialogElement | undefined {
    return this.renderRoot.querySelector("dialog") ?? undefined;
  }

  get #picker(): RobotPicker | undefined {
    const found = this.renderRoot.querySelector("vmc-robot-picker");
    return found instanceof RobotPicker ? found : undefined;
  }

  get #closeButton(): HTMLButtonElement | undefined {
    const found = this.renderRoot.querySelector("button.close");
    return found instanceof HTMLButtonElement ? found : undefined;
  }

  get #sheet(): boolean {
    return this.#media?.matches ?? false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#media = window.matchMedia(NARROW_QUERY);
    this.#media.addEventListener("change", this.#onMediaChange);
  }

  /** Leaving the page ends the selection, so the picker never comes back by itself on a later render. */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#media?.removeEventListener("change", this.#onMediaChange);
    this.#media = undefined;
    if (this.#dialog?.open) this.#close();
  }

  protected override updated(changed: PropertyValues<this>): void {
    const dialog = this.#dialog;
    if (dialog === undefined) return;
    if (this.picked === undefined) {
      dialog.close();
    } else if (!dialog.open) {
      this.#open(dialog);
    } else {
      this.#returnTo = this.opener ?? this.#returnTo;
      const another = changed.has("picked") && !sameValue(changed.get("picked")?.item, this.picked.item);
      void this.#afterPicker(another);
    }
  }

  #open(dialog: HTMLDialogElement): void {
    this.#returnTo = this.opener;
    try {
      dialog.showModal();
    } catch {
      // `showModal` throws when the dialog cannot open: the selection ends as if the user closed it.
      this.#closed();
      return;
    }
    window.addEventListener("resize", this.#place);
    document.addEventListener("scroll", this.#place, { capture: true, passive: true });
    void this.#afterPicker(true);
  }

  /**
   * Once the picker has rendered its rows, which give the size to place: the focus goes to the first robot that can
   * start for a new item, and again when a re-render took it away (a row that can no longer start).
   */
  async #afterPicker(focus: boolean): Promise<void> {
    await this.#picker?.updateComplete;
    if (!this.#dialog?.open) return;
    this.#place();
    if (focus || !this.#holdsFocus()) this.#picker?.focusFirst();
  }

  #holdsFocus(): boolean {
    const active = deepActiveElement();
    if (active === undefined) return false;
    return active === this.#closeButton || (this.#picker?.shadowRoot?.contains(active) ?? false);
  }

  readonly #place = (): void => {
    const dialog = this.#dialog;
    if (!dialog?.open) return;
    const opener = this.opener;
    if (this.#sheet || !opener?.isConnected) {
      dialog.removeAttribute("data-anchored");
      dialog.style.removeProperty("left");
      dialog.style.removeProperty("top");
      return;
    }
    dialog.setAttribute("data-anchored", "");
    const { clientWidth, clientHeight } = document.documentElement;
    const viewport = { width: clientWidth, height: clientHeight };
    const { left, top } = popoverPlace(opener.getBoundingClientRect(), dialog.getBoundingClientRect(), viewport);
    dialog.style.left = `${left}px`;
    dialog.style.top = `${top}px`;
  };

  readonly #onMediaChange = (): void => {
    this.requestUpdate();
  };

  /** Tells the card the selection ended without a choice. */
  #closed(): void {
    this.dispatchEvent(new CustomEvent(PICKER_CLOSED_EVENT));
  }

  /** The user's close (button, Escape, scrim); the card's own closes call `close()` directly and fire nothing. */
  readonly #close = (): void => {
    this.#dialog?.close();
    this.#closed();
  };

  /** Passes the choice on from this element, which the card listens to; the card then closes the picker. */
  readonly #onChosen = (event: Event): void => {
    if (event instanceof RobotChosenEvent) this.dispatchEvent(new RobotChosenEvent(event.detail));
  };

  /** The browser fires `cancel` on Escape; closing here keeps one path, through `close`. */
  readonly #onCancel = (event: Event): void => {
    event.preventDefault();
    this.#close();
  };

  /**
   * A target that is the dialog itself is the scrim: the surface fills the dialog's box. A closing dialog stays on
   * screen while it fades out; a press then is not for it.
   */
  readonly #onPointerDown = (event: Event): void => {
    const dialog = this.#dialog;
    this.#downOnScrim = dialog?.open === true && event.target === dialog;
  };

  /** Only a press that started and ended on the scrim closes: not a text selection released outside. */
  readonly #onClick = (event: Event): void => {
    const onScrim = this.#downOnScrim && event.target === this.#dialog;
    this.#downOnScrim = false;
    if (onScrim) this.#close();
  };

  /** Browsers fire `close` in a later task, after the card may have let go of `opener`: hence `#returnTo`. */
  readonly #onClosed = (): void => {
    window.removeEventListener("resize", this.#place);
    document.removeEventListener("scroll", this.#place, { capture: true });
    const to = this.#returnTo;
    this.#returnTo = undefined;
    if (to?.isConnected) to.focus();
  };

  /**
   * Keeps Tab inside, which the browser would let reach its own toolbar: from the last control, or from anything that
   * is not a control (the heading), Tab goes to the first; Shift+Tab from the first goes to the last. A held Enter or
   * Space repeats nothing, so a key held on a room never goes on to choose a robot.
   */
  readonly #onKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      // Its own, not the browser's `cancel` alone: Home Assistant's dialogs listen to Escape on the page, and the card's
      // editor preview is one of them, so the key stops here and closes only the picker.
      event.preventDefault();
      event.stopPropagation();
      this.#close();
      return;
    }
    if (isRepeatedActivation(event)) {
      event.preventDefault();
      return;
    }
    if (event.key !== "Tab") return;
    const controls: HTMLElement[] = [...(this.#picker?.controls() ?? [])];
    if (this.#closeButton) controls.push(this.#closeButton);
    const active = deepActiveElement();
    const index = active instanceof HTMLElement ? controls.indexOf(active) : -1;
    const edge = event.shiftKey ? index <= 0 : index === -1 || index === controls.length - 1;
    const to = event.shiftKey ? controls.at(-1) : controls[0];
    if (!edge || to === undefined) return;
    event.preventDefault();
    to.focus();
  };

  protected override render(): TemplateResult {
    const label = localize(this.locale, "picker.close");
    return html`<dialog
      class=${this.#sheet ? "sheet" : "popover"}
      aria-label=${this.picked?.name ?? ""}
      aria-modal="true"
      @cancel=${this.#onCancel}
      @close=${this.#onClosed}
      @pointerdown=${this.#onPointerDown}
      @click=${this.#onClick}
      @keydown=${this.#onKeydown}
    >
      <div class="surface">
        <vmc-robot-picker
          .locale=${this.locale}
          .item=${this.picked?.item}
          .itemName=${this.picked?.name ?? ""}
          .candidates=${this.picked?.candidates ?? []}
          .robotNames=${this.robotNames}
          @robot-chosen=${this.#onChosen}
        ></vmc-robot-picker>
        <button type="button" class="close icon-button" aria-label=${label} title=${label} @click=${this.#close}>
          ${CLOSE_ICON}
        </button>
      </div>
    </dialog>`;
  }
}
