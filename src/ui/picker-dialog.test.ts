// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { shadowOf, stylesText } from "../../test/helpers/shadow";
import type { Candidate } from "../app/robots-for-item/choice";
import type { PickedItem } from "./card-session";
import { deepActiveElement } from "./focus";
import { NARROW_QUERY, PICKER_CLOSED_EVENT, PICKER_DIALOG_ELEMENT, PickerDialog } from "./picker-dialog";
import { POPOVER_GAP_PX } from "./popover-place";
import { defineOnce } from "./register";
import { ROBOT_PICKER_ELEMENT, RobotPicker } from "./robot-picker";

const STARTABLE: Candidate = {
  vacuumEntityId: "vacuum.robot_one",
  action: "vacuum",
  state: "docked",
  choice: {
    kind: "path2",
    regionId: "1",
    ownRoomName: "Kitchen",
    call: { domain: "vacuum", service: "send_command", data: { entity_id: "vacuum.robot_one" } },
  },
};
const REFUSED: Candidate = {
  vacuumEntityId: "vacuum.robot_two",
  action: "mop",
  state: "unavailable",
  choice: { kind: "not_startable", reasons: ["unavailable"] },
};

const KITCHEN: PickedItem = {
  item: { kind: "room", imageEntityId: "image.robot_one_rooms_map", regionId: "1" },
  name: "Kitchen",
  candidates: [REFUSED, STARTABLE],
};
const HALL: PickedItem = {
  item: { kind: "area", imageEntityId: "image.robot_one_rooms_map", areaId: "hall" },
  name: "Hall",
  candidates: [STARTABLE],
};

/** A media query list for {@link NARROW_QUERY} that a test switches. */
class FakeMedia extends EventTarget implements MediaQueryList {
  matches = false;
  readonly media = NARROW_QUERY;
  onchange = null;
  addListener(): void {}
  removeListener(): void {}
  switchTo(matches: boolean): void {
    this.matches = matches;
    this.dispatchEvent(new Event("change"));
  }
}

let media: FakeMedia;

beforeAll(() => {
  defineOnce(customElements, ROBOT_PICKER_ELEMENT, RobotPicker);
  defineOnce(customElements, PICKER_DIALOG_ELEMENT, PickerDialog);
});

beforeEach(() => {
  media = new FakeMedia();
  vi.spyOn(window, "matchMedia").mockImplementation((query) => {
    if (query !== NARROW_QUERY) throw new Error(`unexpected query ${query}`);
    return media;
  });
});

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function box(left: number, top: number, width: number, height: number): DOMRect {
  return DOMRect.fromRect({ x: left, y: top, width, height });
}

/** A room button on the page, standing for what opened the picker, at a fixed place on screen. */
function opener(rect: () => DOMRect = () => box(100, 200, 100, 80)): HTMLButtonElement {
  const button = document.createElement("button");
  button.textContent = "Kitchen";
  button.getBoundingClientRect = rect;
  document.body.append(button);
  button.focus();
  return button;
}

async function mount(
  picked: PickedItem | undefined,
  from?: HTMLElement,
  before: (element: PickerDialog) => void = () => undefined,
): Promise<PickerDialog> {
  const element = document.createElement(PICKER_DIALOG_ELEMENT);
  if (!(element instanceof PickerDialog)) throw new Error("not a PickerDialog");
  Object.assign(element, { picked, opener: from, robotNames: new Map([["vacuum.robot_one", "Robot one"]]) });
  before(element);
  document.body.append(element);
  await settle(element);
  return element;
}

/** Waits for the dialog and its picker to render and for the opening work that follows. */
async function settle(element: PickerDialog): Promise<void> {
  await element.updateComplete;
  await pickerOf(element)?.updateComplete;
  await element.updateComplete;
}

function dialogOf(element: PickerDialog): HTMLDialogElement {
  const dialog = shadowOf(element).querySelector("dialog");
  if (!dialog) throw new Error("no dialog");
  return dialog;
}

function pickerOf(element: PickerDialog): RobotPicker | undefined {
  const found = shadowOf(element).querySelector(ROBOT_PICKER_ELEMENT);
  return found instanceof RobotPicker ? found : undefined;
}

function closeButton(element: PickerDialog): HTMLButtonElement {
  const button = shadowOf(element).querySelector("button.close");
  if (!(button instanceof HTMLButtonElement)) throw new Error("no close button");
  return button;
}

function closedEvents(element: PickerDialog): Event[] {
  const events: Event[] = [];
  element.addEventListener(PICKER_CLOSED_EVENT, (event) => events.push(event));
  return events;
}

/** A press as a pointer makes it: down, then a click, on the same element. */
function press(target: Element | null): void {
  target?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function pressTab(element: PickerDialog, shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true, cancelable: true });
  dialogOf(element).dispatchEvent(event);
  return event;
}

describe("PickerDialog", () => {
  it("stays closed while nothing is picked", async () => {
    const element = await mount(undefined);
    expect(dialogOf(element).open).toBe(false);
  });

  it("opens as a modal dialog, labelled by the item's name, listing its robots", async () => {
    const shown = vi.spyOn(HTMLDialogElement.prototype, "showModal");
    const element = await mount(KITCHEN, opener());
    const dialog = dialogOf(element);
    expect(shown).toHaveBeenCalledOnce();
    expect(dialog.open).toBe(true);
    expect(dialog.getAttribute("aria-label")).toBe("Kitchen");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(pickerOf(element)?.candidates).toBe(KITCHEN.candidates);
    expect(pickerOf(element)?.item).toBe(KITCHEN.item);
  });

  it("puts the focus on the first robot that can start", async () => {
    const element = await mount(KITCHEN, opener());
    const picker = pickerOf(element);
    expect(deepActiveElement()).toBe(picker && shadowOf(picker).querySelector("button.choose"));
  });

  it("takes the focus back when a re-render removed the focused row", async () => {
    const element = await mount(KITCHEN, opener());
    document.body.focus();
    element.picked = { ...KITCHEN, candidates: [STARTABLE, REFUSED] };
    await settle(element);
    const picker = pickerOf(element);
    expect(deepActiveElement()).toBe(picker && shadowOf(picker).querySelector("button.choose"));
  });

  it("keeps the focus where it is on a re-render that leaves it inside", async () => {
    const element = await mount(KITCHEN, opener());
    closeButton(element).focus();
    element.picked = { ...KITCHEN, candidates: [STARTABLE, REFUSED] };
    await settle(element);
    expect(deepActiveElement()).toBe(closeButton(element));
  });

  it("does not take the focus when it closed before its list rendered", async () => {
    const from = opener();
    const element = await mount(undefined, from);
    element.picked = KITCHEN;
    await element.updateComplete;
    element.picked = undefined;
    await settle(element);
    expect(deepActiveElement()).toBe(from);
  });

  it("replaces its content and moves the focus when another item is picked while it is open", async () => {
    const element = await mount(KITCHEN, opener());
    element.picked = { ...HALL, candidates: [REFUSED] };
    await settle(element);
    expect(dialogOf(element).open).toBe(true);
    expect(dialogOf(element).getAttribute("aria-label")).toBe("Hall");
    const picker = pickerOf(element);
    expect(deepActiveElement()).toBe(picker && shadowOf(picker).querySelector("h2"));
  });

  describe("closing", () => {
    it("closes on Escape, says so, and gives the focus back to its opener", async () => {
      const from = opener();
      const element = await mount(KITCHEN, from);
      const events = closedEvents(element);
      const cancel = new Event("cancel", { cancelable: true });
      dialogOf(element).dispatchEvent(cancel);
      expect(cancel.defaultPrevented).toBe(true);
      expect(dialogOf(element).open).toBe(false);
      expect(events).toHaveLength(1);
      expect(deepActiveElement()).toBe(from);
    });

    it("keeps its Escape from the dialogs around it, such as the card editor's", async () => {
      const element = await mount(KITCHEN, opener());
      const events = closedEvents(element);
      const outside: Event[] = [];
      const listen = (event: Event) => outside.push(event);
      document.addEventListener("keydown", listen);
      const pressed = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true, cancelable: true });
      dialogOf(element).dispatchEvent(pressed);
      document.removeEventListener("keydown", listen);
      expect(pressed.defaultPrevented).toBe(true);
      expect(outside).toHaveLength(0);
      expect(dialogOf(element).open).toBe(false);
      expect(events).toHaveLength(1);
    });

    it("closes with its close button, named in the card's language", async () => {
      const element = await mount(KITCHEN, opener());
      expect(closeButton(element).getAttribute("aria-label")).toBe("Close");
      const events = closedEvents(element);
      closeButton(element).click();
      expect(dialogOf(element).open).toBe(false);
      expect(events).toHaveLength(1);
    });

    it("closes on a press on the scrim, but not on a press inside", async () => {
      const element = await mount(KITCHEN, opener());
      const events = closedEvents(element);
      press(shadowOf(element).querySelector(".surface"));
      expect(dialogOf(element).open).toBe(true);
      press(dialogOf(element));
      expect(dialogOf(element).open).toBe(false);
      expect(events).toHaveLength(1);
    });

    it("stays open when a press that started inside ends on the scrim (a text selection)", async () => {
      const element = await mount(KITCHEN, opener());
      shadowOf(element)
        .querySelector(".surface")
        ?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      dialogOf(element).dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(dialogOf(element).open).toBe(true);
    });

    it("ignores a press on a dialog that is closing", async () => {
      const element = await mount(KITCHEN, opener());
      const events = closedEvents(element);
      closeButton(element).click();
      press(dialogOf(element));
      expect(events).toHaveLength(1);
    });

    it("gives the focus back to its opener when the browser fires close after the card let go of it", async () => {
      const from = opener();
      const element = await mount(KITCHEN, from);
      const dialog = dialogOf(element);
      dialog.close = () => {
        dialog.removeAttribute("open");
        setTimeout(() => dialog.dispatchEvent(new Event("close")), 0);
      };
      element.addEventListener(PICKER_CLOSED_EVENT, () => {
        element.opener = undefined;
        element.picked = undefined;
      });
      closeButton(element).click();
      await settle(element);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(deepActiveElement()).toBe(from);
    });

    it("closes without an event when its item is gone, and gives the focus back", async () => {
      const from = opener();
      const element = await mount(KITCHEN, from);
      const events = closedEvents(element);
      element.picked = undefined;
      await settle(element);
      expect(dialogOf(element).open).toBe(false);
      expect(events).toHaveLength(0);
      expect(deepActiveElement()).toBe(from);
    });

    it("does not give the focus to an opener that left the page", async () => {
      const from = opener();
      const element = await mount(KITCHEN, from);
      from.remove();
      const focus = vi.spyOn(from, "focus");
      closeButton(element).click();
      expect(focus).not.toHaveBeenCalled();
    });

    it("closes and says so when it leaves the page, so it never reopens by itself", async () => {
      const element = await mount(KITCHEN, opener());
      const dialog = dialogOf(element);
      const events = closedEvents(element);
      element.remove();
      expect(dialog.open).toBe(false);
      expect(events).toHaveLength(1);
    });

    it("says nothing when it leaves the page closed", async () => {
      const element = await mount(undefined);
      const events = closedEvents(element);
      element.remove();
      expect(events).toHaveLength(0);
    });

    it("says it closed when the browser refuses to open it", async () => {
      vi.spyOn(HTMLDialogElement.prototype, "showModal").mockImplementation(() => {
        throw new DOMException("refused", "InvalidStateError");
      });
      let events: Event[] = [];
      await mount(KITCHEN, undefined, (element) => {
        events = closedEvents(element);
      });
      expect(events).toHaveLength(1);
    });
  });

  describe("Tab", () => {
    it("goes from the last control, the close button, back to the first robot's", async () => {
      const element = await mount(KITCHEN, opener());
      closeButton(element).focus();
      const event = pressTab(element);
      expect(event.defaultPrevented).toBe(true);
      expect(deepActiveElement()).toBe(pickerOf(element)?.controls()[0]);
    });

    it("goes from the first control back to the last, the close button, with Shift", async () => {
      const element = await mount(KITCHEN, opener());
      pickerOf(element)?.controls()[0]?.focus();
      const event = pressTab(element, true);
      expect(event.defaultPrevented).toBe(true);
      expect(deepActiveElement()).toBe(closeButton(element));
    });

    it("keeps Tab inside from the heading, when no robot can start", async () => {
      const element = await mount({ ...KITCHEN, candidates: [REFUSED] }, opener());
      const heading = pickerOf(element)?.shadowRoot?.querySelector("h2");
      expect(deepActiveElement()).toBe(heading);
      expect(pressTab(element).defaultPrevented).toBe(true);
      expect(deepActiveElement()).toBe(pickerOf(element)?.controls()[0]);
      heading?.focus();
      expect(pressTab(element, true).defaultPrevented).toBe(true);
      expect(deepActiveElement()).toBe(closeButton(element));
    });

    it("leaves Tab to the browser between the first and the last control", async () => {
      const element = await mount(KITCHEN, opener());
      expect(pressTab(element).defaultPrevented).toBe(false);
      expect(pressTab(element, true).defaultPrevented).toBe(false);
    });

    it("swallows a held Enter or Space, so a key held on a room never chooses a robot", async () => {
      const element = await mount(KITCHEN, opener());
      for (const key of ["Enter", " "]) {
        const held = new KeyboardEvent("keydown", { key, repeat: true, bubbles: true, cancelable: true });
        dialogOf(element).dispatchEvent(held);
        expect(held.defaultPrevented).toBe(true);
      }
      const once = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
      dialogOf(element).dispatchEvent(once);
      expect(once.defaultPrevented).toBe(false);
    });

    it("ignores other keys", async () => {
      const element = await mount(KITCHEN, opener());
      const event = new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true });
      dialogOf(element).dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe("wide screens", () => {
    beforeEach(() => {
      vi.spyOn(HTMLDialogElement.prototype, "getBoundingClientRect").mockReturnValue(box(0, 0, 320, 240));
      vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(1200);
      vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(800);
    });

    it("is a popover anchored next to its opener", async () => {
      const element = await mount(KITCHEN, opener());
      const dialog = dialogOf(element);
      expect(dialog.classList.contains("popover")).toBe(true);
      expect(dialog.hasAttribute("data-anchored")).toBe(true);
      expect(dialog.style.left).toBe(`${200 + POPOVER_GAP_PX}px`);
      expect(dialog.style.top).toBe("200px");
    });

    it("moves with its opener when the page is resized or scrolled", async () => {
      let rect = box(100, 200, 100, 80);
      const element = await mount(
        KITCHEN,
        opener(() => rect),
      );
      rect = box(100, 300, 100, 80);
      window.dispatchEvent(new Event("resize"));
      expect(dialogOf(element).style.top).toBe("300px");
      rect = box(100, 250, 100, 80);
      document.dispatchEvent(new Event("scroll"));
      expect(dialogOf(element).style.top).toBe("250px");
    });

    it("stops following the page once closed", async () => {
      let rect = box(100, 200, 100, 80);
      const element = await mount(
        KITCHEN,
        opener(() => rect),
      );
      closeButton(element).click();
      rect = box(100, 300, 100, 80);
      window.dispatchEvent(new Event("resize"));
      expect(dialogOf(element).style.top).toBe("200px");
    });

    it("moves to its new opener when another item is picked", async () => {
      const element = await mount(KITCHEN, opener());
      element.opener = opener(() => box(100, 400, 100, 80));
      element.picked = HALL;
      await settle(element);
      expect(dialogOf(element).style.top).toBe("400px");
    });

    it("is centred when it has no opener", async () => {
      const element = await mount(KITCHEN);
      expect(dialogOf(element).hasAttribute("data-anchored")).toBe(false);
      expect(dialogOf(element).style.left).toBe("");
    });
  });

  describe("narrow screens", () => {
    it("is a bottom sheet, not anchored", async () => {
      media.matches = true;
      const element = await mount(KITCHEN, opener());
      const dialog = dialogOf(element);
      expect(dialog.classList.contains("sheet")).toBe(true);
      expect(dialog.hasAttribute("data-anchored")).toBe(false);
      expect(dialog.style.left).toBe("");
    });

    it("switches between popover and sheet when the screen changes", async () => {
      const element = await mount(KITCHEN, opener());
      media.switchTo(true);
      await element.updateComplete;
      expect(dialogOf(element).classList.contains("sheet")).toBe(true);
      expect(dialogOf(element).hasAttribute("data-anchored")).toBe(false);
      media.switchTo(false);
      await element.updateComplete;
      expect(dialogOf(element).classList.contains("popover")).toBe(true);
      expect(dialogOf(element).hasAttribute("data-anchored")).toBe(true);
    });

    it("stops listening to the screen once it left the page", async () => {
      const element = await mount(KITCHEN, opener());
      element.remove();
      const update = vi.spyOn(element, "requestUpdate");
      media.switchTo(true);
      expect(update).not.toHaveBeenCalled();
    });
  });

  it("speaks French", async () => {
    const element = await mount(undefined, undefined, (created) => {
      created.locale = "fr";
    });
    expect(closeButton(element).getAttribute("aria-label")).toBe("Fermer");
  });

  it("uses the fast animation token and no motion when the user asks for less", () => {
    const rules = stylesText(PickerDialog).replace(/\s+/g, " ");
    expect(rules).toContain("var(--ha-animation-duration-fast");
    expect(rules).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("gives its close button a 44 px touch target", () => {
    const rules = stylesText(PickerDialog).replace(/\s+/g, " ");
    const rule = rules.slice(rules.indexOf(".icon-button {"));
    expect(rule.slice(0, rule.indexOf("}"))).toMatch(/width: 44px;.*height: 44px;/);
  });
});
