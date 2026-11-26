// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  buttonNamed,
  buttonTexts,
  dialogOf,
  open,
  PARAMS,
  pressEscape,
  renderDialog,
  settled,
  textOf,
  titleOf,
  useConfirmDialog,
} from "../../test/helpers/confirm-dialog";
import { shadowOf } from "../../test/helpers/shadow";
import type { ConfirmDialog } from "./confirm-dialog";

useConfirmDialog();

describe("ConfirmDialog", () => {
  it("is closed until shown", async () => {
    const element = await renderDialog();
    expect(dialogOf(element).open).toBe(false);
  });

  it("opens with the title and text it is given", async () => {
    const element = await renderDialog();
    await open(element);
    expect(dialogOf(element).open).toBe(true);
    expect(titleOf(element)).toBe(PARAMS.title);
    expect(textOf(element)).toBe(PARAMS.text);
  });

  it("is labelled by its title and described by its text", async () => {
    const element = await renderDialog();
    await open(element);
    const dialog = dialogOf(element);
    const labelId = dialog.getAttribute("aria-labelledby") ?? "";
    const descriptionId = dialog.getAttribute("aria-describedby") ?? "";
    expect(shadowOf(element).getElementById(labelId)?.textContent?.trim()).toBe(PARAMS.title);
    expect(shadowOf(element).getElementById(descriptionId)?.textContent?.trim()).toBe(PARAMS.text);
  });

  it("shows no empty paragraph, and is described by nothing, when the text is empty", async () => {
    const element = await renderDialog();
    await open(element, { ...PARAMS, text: "" });
    expect(textOf(element)).toBeUndefined();
    expect(dialogOf(element).hasAttribute("aria-describedby")).toBe(false);
  });

  it.each([["Enter"], [" "]])("drops a held %j key, so only a new press confirms", async (key) => {
    const element = await renderDialog();
    await open(element);
    const repeated = new KeyboardEvent("keydown", { key, repeat: true, bubbles: true, cancelable: true });
    buttonNamed(element, "Start").dispatchEvent(repeated);
    const first = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    buttonNamed(element, "Start").dispatchEvent(first);
    expect([repeated.defaultPrevented, first.defaultPrevented]).toEqual([true, false]);
  });

  it("opens as a modal dialog", async () => {
    const element = await renderDialog();
    const dialog = dialogOf(element);
    let modal = false;
    dialog.showModal = () => {
      modal = true;
      dialog.setAttribute("open", "");
    };
    await open(element);
    expect(modal).toBe(true);
  });

  it("puts the focus on the confirm button", async () => {
    const element = await renderDialog();
    await open(element);
    expect(shadowOf(element).activeElement).toBe(buttonNamed(element, "Start"));
  });

  it("shows the dismiss button before the confirm button, both plain buttons", async () => {
    const element = await renderDialog();
    await open(element);
    expect(buttonTexts(element)).toEqual(["Not now", "Start"]);
    expect(Array.from(shadowOf(element).querySelectorAll("button"), (button) => button.type)).toEqual([
      "button",
      "button",
    ]);
  });

  it.each([
    ["confirmed", (element: ConfirmDialog) => buttonNamed(element, "Start").click(), true],
    ["dismissed", (element: ConfirmDialog) => buttonNamed(element, "Not now").click(), false],
    ["cancelled with Escape", pressEscape, false],
  ] as const)("resolves when %s, and closes", async (_how, act, expected) => {
    const element = await renderDialog();
    const { result } = await open(element);
    act(element);
    expect(await result).toBe(expected);
    expect(dialogOf(element).open).toBe(false);
  });

  it("resolves false when the browser closes it without a choice", async () => {
    const element = await renderDialog();
    const { result } = await open(element);
    dialogOf(element).close();
    expect(await result).toBe(false);
  });

  it("does nothing on a click on the scrim", async () => {
    const element = await renderDialog();
    const { result } = await open(element);
    dialogOf(element).click();
    expect(await settled(result)).toBe("pending");
    expect(dialogOf(element).open).toBe(true);
  });

  it("resolves exactly once", async () => {
    const element = await renderDialog();
    const { result } = await open(element);
    buttonNamed(element, "Start").click();
    pressEscape(element);
    dialogOf(element).close();
    expect(await result).toBe(true);
  });

  it("renders markup in its strings as literal text", async () => {
    const element = await renderDialog();
    const markup = '<b>bold</b><img src="x" onerror="alert(1)">';
    await open(element, { title: markup, text: markup, confirmText: markup, dismissText: markup });
    expect(shadowOf(element).querySelector("b, img")).toBeNull();
    expect(titleOf(element)).toBe(markup);
    expect(textOf(element)).toBe(markup);
    expect(buttonTexts(element)).toEqual([markup, markup]);
  });

  it.each([
    ["en", "Cancel", "OK"],
    ["fr", "Annuler", "OK"],
  ] as const)("labels its buttons in %s when no button text is given", async (locale, dismiss, confirm) => {
    const element = await renderDialog();
    element.locale = locale;
    await open(element, { title: PARAMS.title, text: PARAMS.text });
    expect(buttonTexts(element)).toEqual([dismiss, confirm]);
  });
});
