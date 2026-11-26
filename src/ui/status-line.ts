import { html, nothing, type TemplateResult } from "lit";
import { keyed } from "lit/directives/keyed.js";
import type { ProgressEntry } from "../app/progress/progress-tracker";
import type { Locale } from "../i18n/catalogs";
import type { CardView, ReadyView } from "./card-view";
import { progressContext, progressNames } from "./progress-list";
import { progressLines } from "./progress-words";
import type { StartNotice } from "./start-flow";
import { startNoticeView } from "./start-notice";

const NONE: readonly ProgressEntry[] = Object.freeze([]);

/**
 * The card's words in its status region beyond the view's (ADR 0003 « Where the result shows », item 4): the last
 * start's notice, until another replaces it, then the words of the progress entries that changed in the last change.
 * The tracker keeps an entry's identity until its phase, error or status changes, so a new object is a change. Each
 * change renders new nodes, so it is announced even when its words equal the last ones; a re-render for anything else
 * announces nothing. Words of a dismissed entry go, and none show while the plans are not shown. They are read by a
 * screen reader only: the same words show on the room and under its plan.
 */
export class StatusLine {
  #notice: StartNotice | undefined;
  #ready: ReadyView | undefined;
  #last: readonly ProgressEntry[] = NONE;
  #announced: readonly ProgressEntry[] = NONE;
  #change = 0;

  /** Shows a start's notice, replacing the one before; `undefined` clears it. */
  show(notice: StartNotice | undefined): void {
    this.#notice = notice;
  }

  /** Said once: the card left the page, so the words shown before are not said again when it comes back. */
  forget(): void {
    this.#announced = NONE;
  }

  /** Reads a new view; call it before each render. */
  update(view: CardView): void {
    if (view.kind !== "ready") {
      this.#ready = undefined;
      this.#announced = NONE;
      return;
    }
    this.#ready = view;
    if (view.progress === this.#last) return;
    const previous = new Set(this.#last);
    this.#last = view.progress;
    const changed = view.progress.filter((entry) => !previous.has(entry));
    if (changed.length === 0) return;
    this.#announced = changed;
    this.#change += 1;
  }

  /** The words for the status region, the robot named as the card shows it. */
  view(locale: Locale, robotName: (vacuumEntityId: string) => string): TemplateResult {
    const notice = this.#notice === undefined ? nothing : startNoticeView(locale, this.#notice, robotName);
    return html`${notice}${this.#progress(locale)}`;
  }

  #progress(locale: Locale): unknown {
    const ready = this.#ready;
    const shown = ready ? this.#announced.filter((entry) => ready.progress.includes(entry)) : NONE;
    if (ready === undefined || shown.length === 0) return nothing;
    const context = progressContext(ready, locale);
    const lines = shown.flatMap(
      (entry) => progressLines(locale, entry, progressNames(entry, context), ready.isAdmin).lines,
    );
    return keyed(this.#change, html`<div class="visually-hidden">${lines.map((line) => html`<p>${line}</p>`)}</div>`);
  }
}
