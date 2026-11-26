import type { CleanController } from "../app/start-clean/clean-controller";
import type { Locale } from "../i18n/catalogs";
import { askConfirmation, type Confirmer } from "./ask-confirmation";
import { confirmParams } from "./confirm-words";
import type { Focusable } from "./focus";
import { holdKeyRepeats } from "./key-repeat";
import type { RobotChosen } from "./robot-picker";
import { type StartNotice, startFlow } from "./start-flow";

/** What the card gives its starts. */
export interface CardStartHost {
  /** The card: Home Assistant's confirmation is shown for it. */
  readonly element: HTMLElement;
  locale(): Locale;
  robotName(vacuumEntityId: string): string;
  /** `true` in the card editor. */
  preview(): boolean;
  controller(): Pick<CleanController, "prepare" | "confirm" | "dismiss"> | undefined;
  /** The card's own confirmation, for when Home Assistant's card helpers are missing. */
  ownDialog(): Confirmer | undefined;
  /** Closes the picker and waits until it is closed. */
  closePicker(): Promise<void>;
  /** Shows a notice in the status line, replacing the one before; `undefined` clears it. */
  show(notice: StartNotice | undefined): void;
}

/**
 * The card's starts (ADR 0003 « Amendment (2026-11-24) », « Where the result shows »; ADR 0004 « Confirmation »): the
 * picker closes before the question opens, at most one question is open, and held keys repeat nothing until it is
 * answered. Once answered, the focus goes back to the room and another robot can be chosen; a confirmed start clears
 * the last notice, and its progress then tells what happens (ADR 0003 « Progress on a room »). The controller keeps one
 * send per confirmation and one start in flight per robot.
 */
export class CardStart {
  readonly #host: CardStartHost;
  #asking = false;
  /** Ends the open question's lock and key hold, for a card that leaves the page. */
  #abort: (() => void) | undefined;

  constructor(host: CardStartHost) {
    this.#host = host;
  }

  /** Starts the flow for a choice, unless a question is already open; resolves when its outcome is shown. */
  choose(chosen: RobotChosen, itemName: string, opener: Focusable | undefined): Promise<void> {
    if (this.#asking) return Promise.resolve();
    this.#asking = true;
    const release = holdKeyRepeats();
    let open = true;
    const answered = (confirmed: boolean): void => {
      if (!open) return;
      open = false;
      this.#asking = false;
      this.#abort = undefined;
      release();
      if (opener?.isConnected) opener.focus();
      if (confirmed) this.#host.show(undefined);
    };
    this.#abort = () => answered(false);
    return this.#run(chosen, itemName, answered).finally(() => answered(false));
  }

  /**
   * Releases an open question's hold when the card leaves the page: a question that never settles must not keep the
   * lock or the page-wide key hold. A confirmation that still settles later is handled by the controller as usual.
   */
  abort(): void {
    this.#abort?.();
  }

  async #run(chosen: RobotChosen, itemName: string, answered: (confirmed: boolean) => void): Promise<void> {
    const host = this.#host;
    try {
      await host.closePicker();
      const notice = await startFlow(
        {
          preview: host.preview(),
          controller: host.controller(),
          ask: (intent) => {
            const params = confirmParams(host.locale(), intent, host.robotName(intent.vacuumEntityId), itemName);
            return askConfirmation(host.element, params, () => host.ownDialog());
          },
          answered,
        },
        chosen,
      );
      if (notice) host.show(notice);
    } catch {
      // Nothing a start does may break the dashboard; the controller has stored any outcome.
    }
  }
}
