import type { ConfirmDialog, ConfirmDialogParams } from "./confirm-dialog";

/** What asks the question when Home Assistant's card helpers are missing: the card's own `vmc-confirm-dialog`. */
export type Confirmer = Pick<ConfirmDialog, "show">;

/**
 * The user's answer: `confirmed` only for a dialog that resolved `true`; `cancelled` for any other answer; `unasked`
 * when no dialog could ask, or Home Assistant's failed: nothing is sent, and the card says so.
 */
export type Answer = "confirmed" | "cancelled" | "unasked";

type ShowConfirmation = (
  element: HTMLElement,
  params: ConfirmDialogParams & { destructive: false },
) => Promise<unknown>;

/**
 * Asks the user to confirm (ADR 0004 « Confirmation »): Home Assistant's standard confirmation through the card
 * helpers, else the card's own dialog when the helpers are absent, rejected or without `showConfirmationDialog`
 * (`docs/research/ha-frontend.md` § 3). A standard confirmation that fails after it was found answers `unasked`: it
 * may already have shown, so the card never asks a second time.
 */
export async function askConfirmation(
  element: HTMLElement,
  params: ConfirmDialogParams,
  fallback: () => Confirmer | undefined,
): Promise<Answer> {
  const show = await standardConfirmation();
  // A card that left the page while the helpers loaded: no dialog would ever answer for it.
  if (!element.isConnected) return "unasked";
  let answer: unknown;
  try {
    answer =
      show === undefined ? await fallback()?.show(params) : await show(element, { ...params, destructive: false });
  } catch {
    return "unasked";
  }
  if (answer === undefined) return "unasked";
  return answer === true ? "confirmed" : "cancelled";
}

/** `showConfirmationDialog` from the card helpers, or `undefined` when any step is missing or fails. */
async function standardConfirmation(): Promise<ShowConfirmation | undefined> {
  const load = window.loadCardHelpers;
  if (typeof load !== "function") return undefined;
  let helpers: unknown;
  try {
    helpers = await load();
  } catch {
    return undefined;
  }
  if (typeof helpers !== "object" || helpers === null || !("showConfirmationDialog" in helpers)) return undefined;
  const show = helpers.showConfirmationDialog;
  if (typeof show !== "function") return undefined;
  return (element, params) => Promise.resolve<unknown>(show.call(helpers, element, params));
}
