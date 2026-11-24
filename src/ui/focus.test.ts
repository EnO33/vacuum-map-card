// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { deepActiveElement } from "./focus";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("deepActiveElement", () => {
  it("gives the focused element of the document", () => {
    const button = document.createElement("button");
    document.body.append(button);
    button.focus();
    expect(deepActiveElement()).toBe(button);
  });

  it("follows the focus into nested shadow roots", () => {
    const outer = document.createElement("div");
    const middle = document.createElement("div");
    const button = document.createElement("button");
    outer.attachShadow({ mode: "open" }).append(middle);
    middle.attachShadow({ mode: "open" }).append(button);
    document.body.append(outer);
    button.focus();
    expect(deepActiveElement()).toBe(button);
  });

  it("gives a focused SVG shape", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("tabindex", "0");
    svg.append(path);
    document.body.append(svg);
    path.focus();
    expect(deepActiveElement()).toBe(path);
  });

  it("gives the body when nothing else has the focus", () => {
    expect(deepActiveElement()).toBe(document.body);
  });

  it("gives nothing when no element has the focus", () => {
    vi.spyOn(document, "activeElement", "get").mockReturnValue(null);
    expect(deepActiveElement()).toBeUndefined();
  });
});
