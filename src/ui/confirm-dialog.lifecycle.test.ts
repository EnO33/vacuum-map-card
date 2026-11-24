// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  buttonNamed,
  dialogOf,
  newDialog,
  open,
  PARAMS,
  pressEscape,
  renderDialog,
  titleOf,
  useConfirmDialog,
} from "../../test/helpers/confirm-dialog";

useConfirmDialog();

describe("ConfirmDialog, one at a time", () => {
  it("refuses a second show while open, and keeps the first one", async () => {
    const element = await renderDialog();
    const { result: first } = await open(element);
    const second = element.show({ ...PARAMS, title: "Other title" });
    expect(await second).toBe(false);
    await element.updateComplete;
    expect(titleOf(element)).toBe(PARAMS.title);
    buttonNamed(element, "Start").click();
    expect(await first).toBe(true);
  });

  it("refuses a second show made before the first one has rendered", async () => {
    const element = await renderDialog();
    const first = element.show(PARAMS);
    expect(await element.show(PARAMS)).toBe(false);
    await element.updateComplete;
    pressEscape(element);
    expect(await first).toBe(false);
  });

  it("can be shown again after it closed", async () => {
    const element = await renderDialog();
    const { result: first } = await open(element);
    buttonNamed(element, "Start").click();
    await first;
    const { result: second } = await open(element, { ...PARAMS, title: "Again" });
    expect(dialogOf(element).open).toBe(true);
    expect(titleOf(element)).toBe("Again");
    pressEscape(element);
    expect(await second).toBe(false);
  });

  it("does not take a confirmation left over from the previous time", async () => {
    const element = await renderDialog();
    const { result: first } = await open(element);
    buttonNamed(element, "Start").click();
    await first;
    const { result: second } = await open(element);
    dialogOf(element).close();
    expect(await second).toBe(false);
  });
});

describe("ConfirmDialog, focus", () => {
  it("gives the focus back to the element focused before it opened", async () => {
    const before = document.createElement("button");
    document.body.append(before);
    before.focus();
    const element = await renderDialog();
    const { result } = await open(element);
    buttonNamed(element, "Not now").click();
    await result;
    expect(document.activeElement).toBe(before);
  });

  it("gives the focus back inside a shadow root", async () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const inner = document.createElement("button");
    root.append(inner);
    document.body.append(host);
    inner.focus();
    const element = await renderDialog();
    const { result } = await open(element);
    buttonNamed(element, "Start").click();
    await result;
    expect(root.activeElement).toBe(inner);
  });

  it("leaves the focus alone when the element focused before is gone", async () => {
    const before = document.createElement("button");
    document.body.append(before);
    before.focus();
    const element = await renderDialog();
    const { result } = await open(element);
    before.remove();
    buttonNamed(element, "Start").click();
    expect(await result).toBe(true);
  });
});

describe("ConfirmDialog, off the page", () => {
  it("resolves false when removed while open", async () => {
    const element = await renderDialog();
    const { result } = await open(element);
    element.remove();
    expect(await result).toBe(false);
  });

  it("resolves false when removed before it rendered, and stays closed", async () => {
    const element = await renderDialog();
    const result = element.show(PARAMS);
    element.remove();
    expect(await result).toBe(false);
    await element.updateComplete;
    expect(dialogOf(element).open).toBe(false);
  });

  it("refuses to show when it was never on the page", async () => {
    const element = newDialog();
    expect(await element.show(PARAMS)).toBe(false);
  });

  it("refuses to show once removed, and can be shown again when back", async () => {
    const element = await renderDialog();
    element.remove();
    expect(await element.show(PARAMS)).toBe(false);
    document.body.append(element);
    const { result } = await open(element);
    expect(dialogOf(element).open).toBe(true);
    pressEscape(element);
    expect(await result).toBe(false);
  });

  it("resolves false when the dialog cannot open", async () => {
    const element = await renderDialog();
    dialogOf(element).showModal = () => {
      throw new DOMException("cannot open", "InvalidStateError");
    };
    const { result } = await open(element);
    expect(await result).toBe(false);
    const { result: again } = await open(element);
    expect(await again).toBe(false);
  });
});
