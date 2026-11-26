// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { holdKeyRepeats } from "./key-repeat";

/** Dispatches a key event on a button in the page; `true` when something prevented its default. */
function key(type: "keydown" | "keyup", name: string, repeat = false): boolean {
  const target = document.createElement("button");
  document.body.append(target);
  const event = new KeyboardEvent(type, { key: name, repeat, bubbles: true, cancelable: true, composed: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

let release: () => void = () => undefined;

afterEach(() => {
  release();
  document.body.replaceChildren();
});

describe("holdKeyRepeats", () => {
  it("drops repeated Enter and Space only", () => {
    release = holdKeyRepeats();
    expect([key("keydown", "Enter", true), key("keydown", " ", true)]).toEqual([true, true]);
    expect([key("keydown", "Enter"), key("keydown", "a", true)]).toEqual([false, false]);
  });

  it("ends when it is released", () => {
    holdKeyRepeats()();
    expect(key("keydown", "Enter", true)).toBe(false);
  });

  it.each([["Enter"], [" "]])("ends by itself once %j is released", (name) => {
    release = holdKeyRepeats();
    key("keyup", "a");
    expect(key("keydown", name, true)).toBe(true);
    key("keyup", name);
    expect(key("keydown", name, true)).toBe(false);
  });

  it("ends by itself when the window loses the focus", () => {
    release = holdKeyRepeats();
    window.dispatchEvent(new Event("blur"));
    expect(key("keydown", "Enter", true)).toBe(false);
  });
});
