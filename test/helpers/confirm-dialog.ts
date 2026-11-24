// Test helper: the card's own confirmation element in the DOM test environment. Call `useConfirmDialog()` once per
// test file.
import { afterEach, beforeAll } from "vitest";
import { ConfirmDialog, type ConfirmDialogParams } from "../../src/ui/confirm-dialog";
import { shadowOf } from "./shadow";

const TAG = "vmc-confirm-dialog-under-test";

export const PARAMS: ConfirmDialogParams = {
  title: "Start cleaning?",
  text: "Send Robot A to vacuum Room 1?",
  confirmText: "Start",
  dismissText: "Not now",
};

/** Defines the element under a test name and empties the page after each test. */
export function useConfirmDialog(): void {
  beforeAll(() => {
    customElements.define(TAG, ConfirmDialog);
  });
  afterEach(() => {
    document.body.replaceChildren();
  });
}

/** A new dialog element, never attached. */
export function newDialog(): ConfirmDialog {
  const element = document.createElement(TAG);
  if (!(element instanceof ConfirmDialog)) {
    throw new Error("element is not a ConfirmDialog");
  }
  return element;
}

/** A new dialog element on the page, rendered and closed. */
export async function renderDialog(): Promise<ConfirmDialog> {
  const element = newDialog();
  document.body.append(element);
  await element.updateComplete;
  return element;
}

export function titleOf(element: ConfirmDialog): string | undefined {
  return shadowOf(element).querySelector("h2")?.textContent?.trim();
}

export function textOf(element: ConfirmDialog): string | undefined {
  return shadowOf(element).querySelector("p")?.textContent?.trim();
}

export function buttonTexts(element: ConfirmDialog): (string | undefined)[] {
  return Array.from(shadowOf(element).querySelectorAll("button"), (button) => button.textContent?.trim());
}

export function dialogOf(element: ConfirmDialog): HTMLDialogElement {
  const dialog = shadowOf(element).querySelector("dialog");
  if (dialog === null) {
    throw new Error("no dialog rendered");
  }
  return dialog;
}

export function buttonNamed(element: ConfirmDialog, name: string): HTMLButtonElement {
  const button = Array.from(shadowOf(element).querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.trim() === name,
  );
  if (button === undefined) {
    throw new Error(`no button named ${name}`);
  }
  return button;
}

/**
 * Shows the dialog and waits until it is open, as a user would see it. The result is wrapped: an async function
 * returning the bare promise would wait for it to settle.
 */
export async function open(
  element: ConfirmDialog,
  params: ConfirmDialogParams = PARAMS,
): Promise<{ readonly result: Promise<boolean> }> {
  const result = element.show(params);
  await element.updateComplete;
  return { result };
}

/** What the browser fires on the dialog when the user presses Escape. */
export function pressEscape(element: ConfirmDialog): void {
  dialogOf(element).dispatchEvent(new Event("cancel", { cancelable: true }));
}

/** Settles to the result, or to `"pending"` when the promise has not settled after queued work ran. */
export async function settled(result: Promise<boolean>): Promise<boolean | "pending"> {
  return Promise.race([result, new Promise<"pending">((resolve) => setTimeout(() => resolve("pending"), 0))]);
}
