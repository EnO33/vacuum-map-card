import { html, LitElement, nothing } from "lit";
import type { Locale } from "../i18n/catalogs";
import { localize } from "../i18n/localize";
import { confirmDialogStyles } from "./confirm-dialog.styles";
import { deepActiveElement, type Focusable } from "./focus";
import { isRepeatedActivation } from "./key-repeat";

/** Custom element name of the card's own confirmation. */
export const CONFIRM_DIALOG_ELEMENT = "vmc-confirm-dialog";

/**
 * What the confirmation shows: the subset of Home Assistant's `showConfirmationDialog` parameters the card uses
 * (`docs/research/ha-frontend.md` § 3), all plain text. A missing button text falls back to the card's own « OK » and
 * « Cancel ».
 */
export interface ConfirmDialogParams {
  readonly title: string;
  readonly text: string;
  readonly confirmText?: string;
  readonly dismissText?: string;
}

/** A confirmation from `show` until it settles. */
interface Pending {
  readonly params: ConfirmDialogParams;
  readonly resolve: (confirmed: boolean) => void;
  /** Where the focus goes back when it settles. */
  readonly returnFocus: Focusable | undefined;
}

/** `returnValue` of the `<dialog>` when the user confirmed; any other value is a cancel. */
const CONFIRMED = "confirm";

/**
 * The card's own confirmation, used only when Home Assistant's card helpers are missing (ADR 0004 « Confirmation »).
 * It looks and behaves like Home Assistant's standard one: a modal `<dialog>` in the top layer (§ 13), the focus on
 * the confirm button, Escape cancels, a click on the scrim does nothing. It shows no result or error: the card does.
 */
export class ConfirmDialog extends LitElement {
  static override styles = confirmDialogStyles;

  static override properties = { locale: { attribute: false } };

  /** Language of the default button texts. */
  declare locale: Locale;

  #pending: Pending | undefined;

  constructor() {
    super();
    this.locale = "en";
  }

  get #dialog(): HTMLDialogElement | undefined {
    return this.renderRoot.querySelector("dialog") ?? undefined;
  }

  get #confirmButton(): HTMLButtonElement | undefined {
    const button = this.renderRoot.querySelector(".confirm");
    return button instanceof HTMLButtonElement ? button : undefined;
  }

  /**
   * Opens the confirmation and resolves `true` when the user confirms, `false` when they cancel, press Escape, or the
   * element leaves the page. It resolves exactly once. While one is open, or when the element is not on the page,
   * the call is refused: it resolves `false` at once and leaves an open one as it is.
   */
  show(params: ConfirmDialogParams): Promise<boolean> {
    if (this.#pending !== undefined || !this.isConnected) {
      return Promise.resolve(false);
    }
    const result = new Promise<boolean>((resolve) => {
      this.#pending = { params, resolve, returnFocus: deepActiveElement() };
    });
    this.requestUpdate();
    void this.updateComplete.then(() => this.#open());
    return result;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#dialog?.close();
    this.#settle(false);
  }

  #open(): void {
    const dialog = this.#dialog;
    if (this.#pending === undefined || dialog === undefined) {
      return;
    }
    dialog.returnValue = "";
    try {
      dialog.showModal();
    } catch {
      // `showModal` throws when the dialog cannot open (left the page, already open as a non-modal): never ask.
      this.#settle(false);
      return;
    }
    // `autofocus` covers browsers; the explicit call keeps the rule where `showModal` does not run focusing steps.
    this.#confirmButton?.focus();
  }

  readonly #onConfirm = (): void => {
    this.#dialog?.close(CONFIRMED);
  };

  readonly #onDismiss = (): void => {
    this.#dialog?.close();
  };

  /** A held Enter or Space repeats nothing: only a new key press confirms. */
  readonly #onKeydown = (event: KeyboardEvent): void => {
    if (isRepeatedActivation(event)) event.preventDefault();
  };

  /** The browser fires `cancel` on Escape; closing here keeps one path to the result, through `close`. */
  readonly #onCancel = (event: Event): void => {
    event.preventDefault();
    this.#onDismiss();
  };

  readonly #onClose = (): void => {
    this.#settle(this.#dialog?.returnValue === CONFIRMED);
  };

  #settle(confirmed: boolean): void {
    const pending = this.#pending;
    if (pending === undefined) {
      return;
    }
    this.#pending = undefined;
    pending.resolve(confirmed);
    if (pending.returnFocus?.isConnected) {
      pending.returnFocus.focus();
    }
  }

  protected override render() {
    const params = this.#pending?.params;
    return html`
      <dialog
        aria-labelledby="title"
        aria-describedby=${params?.text ? "text" : nothing}
        @cancel=${this.#onCancel}
        @close=${this.#onClose}
        @keydown=${this.#onKeydown}
      >
        <h2 id="title">${params?.title}</h2>
        ${params?.text ? html`<p id="text">${params.text}</p>` : nothing}
        <div class="actions">
          <button type="button" class="dismiss" @click=${this.#onDismiss}>
            ${params?.dismissText ?? localize(this.locale, "confirm.cancel")}
          </button>
          <button type="button" class="confirm" autofocus @click=${this.#onConfirm}>
            ${params?.confirmText ?? localize(this.locale, "confirm.ok")}
          </button>
        </div>
      </dialog>
    `;
  }
}
