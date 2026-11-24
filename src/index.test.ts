// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { CARD_VERSION } from "./version";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  window.customCards = undefined;
});

async function loadEntry(): Promise<void> {
  await import("./index");
}

describe("entry module", () => {
  it("registers the card element, its picker entry and one banner, even when evaluated twice", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await loadEntry();
    vi.resetModules();
    await loadEntry();

    expect(customElements.get("vacuum-map-card")).toBeDefined();
    expect(window.customCards).toEqual([
      {
        type: "vacuum-map-card",
        name: "Vacuum Map Card",
        preview: false,
        documentationURL: "https://github.com/EnO33/vacuum-map-card",
      },
    ]);
    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(`vacuum-map-card ${CARD_VERSION}`);
  });

  it("registers the card's own confirmation element", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await loadEntry();
    expect(customElements.get("vmc-confirm-dialog")).toBeDefined();
  });
});
