// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { setCardHelpers, useCardHelpers } from "../../test/helpers/card-helpers";
import { askConfirmation, type Confirmer } from "./ask-confirmation";
import type { ConfirmDialogParams } from "./confirm-dialog";

const PARAMS: ConfirmDialogParams = {
  title: "Send Robot A to vacuum Bedroom?",
  text: "",
  confirmText: "Start",
  dismissText: "Cancel",
};

const ELEMENT = document.createElement("div");
document.body.append(ELEMENT);

/** A fallback dialog answering `answer`, with its calls kept. */
function fallback(answer: boolean): Confirmer & { readonly shown: ConfirmDialogParams[] } {
  const shown: ConfirmDialogParams[] = [];
  return {
    shown,
    show(params) {
      shown.push(params);
      return Promise.resolve(answer);
    },
  };
}

useCardHelpers();

describe("askConfirmation", () => {
  it.each([
    ["absent", undefined],
    ["not a function", { showConfirmationDialog: () => true }],
    ["rejecting", () => Promise.reject(new Error("no helpers"))],
    [
      "throwing",
      () => {
        throw new Error("no helpers");
      },
    ],
    ["missing the function", () => Promise.resolve({ showAlertDialog: () => undefined })],
    ["answering nothing", () => Promise.resolve(undefined)],
  ])("uses the card's own dialog when the card helpers are %s", async (_case, loader) => {
    setCardHelpers(loader);
    const own = fallback(true);
    await expect(askConfirmation(ELEMENT, PARAMS, () => own)).resolves.toBe("confirmed");
    expect(own.shown).toEqual([PARAMS]);
  });

  it("answers unasked, showing nothing, for a card that left the page", async () => {
    const show = vi.fn(() => Promise.resolve(true));
    setCardHelpers(() => Promise.resolve({ showConfirmationDialog: show }));
    const own = fallback(true);
    await expect(askConfirmation(document.createElement("div"), PARAMS, () => own)).resolves.toBe("unasked");
    expect(show).not.toHaveBeenCalled();
    expect(own.shown).toEqual([]);
  });

  it("answers cancelled when the card's own dialog answers no", async () => {
    await expect(askConfirmation(ELEMENT, PARAMS, () => fallback(false))).resolves.toBe("cancelled");
  });

  it("answers unasked when neither the helpers nor the card's own dialog can ask", async () => {
    await expect(askConfirmation(ELEMENT, PARAMS, () => undefined)).resolves.toBe("unasked");
  });

  it.each([
    [true, "confirmed"],
    [false, "cancelled"],
    ["yes", "cancelled"],
    [1, "cancelled"],
  ])("uses Home Assistant's confirmation when present: %s answers %s", async (answer, confirmed) => {
    const show = vi.fn((_element: unknown, _params: unknown) => Promise.resolve(answer));
    setCardHelpers(() => Promise.resolve({ showConfirmationDialog: show }));
    const own = fallback(true);
    await expect(askConfirmation(ELEMENT, PARAMS, () => own)).resolves.toBe(confirmed);
    expect(show.mock.calls).toEqual([[ELEMENT, { ...PARAMS, destructive: false }]]);
    expect(own.shown).toEqual([]);
  });

  it.each([
    ["rejects", () => Promise.reject(new Error("closed"))],
    [
      "throws",
      () => {
        throw new Error("closed");
      },
    ],
  ])("answers unasked, never the card's own dialog, when Home Assistant's confirmation %s", async (_case, show) => {
    setCardHelpers(() => Promise.resolve({ showConfirmationDialog: show }));
    const own = fallback(true);
    await expect(askConfirmation(ELEMENT, PARAMS, () => own)).resolves.toBe("unasked");
    expect(own.shown).toEqual([]);
  });
});
