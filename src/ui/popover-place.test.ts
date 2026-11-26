import { describe, expect, it } from "vitest";
import { POPOVER_GAP_PX, POPOVER_MARGIN_PX, popoverPlace } from "./popover-place";

const VIEWPORT = { width: 1200, height: 800 };
const SIZE = { width: 320, height: 240 };

function anchor(left: number, top: number, width = 100, height = 80) {
  return { left, top, right: left + width, bottom: top + height };
}

describe("popoverPlace", () => {
  it("sits right of the anchor, aligned with its top, when there is room", () => {
    expect(popoverPlace(anchor(100, 200), SIZE, VIEWPORT)).toEqual({ left: 200 + POPOVER_GAP_PX, top: 200 });
  });

  it("flips to the left of the anchor when the right side has no room", () => {
    expect(popoverPlace(anchor(900, 200), SIZE, VIEWPORT)).toEqual({ left: 900 - POPOVER_GAP_PX - 320, top: 200 });
  });

  it("stays inside the viewport at the bottom", () => {
    expect(popoverPlace(anchor(100, 700), SIZE, VIEWPORT).top).toBe(800 - POPOVER_MARGIN_PX - 240);
  });

  it("stays inside the viewport at the top when the anchor is scrolled above it", () => {
    expect(popoverPlace(anchor(100, -50), SIZE, VIEWPORT).top).toBe(POPOVER_MARGIN_PX);
  });

  it("goes below the anchor when neither side has room", () => {
    const wide = anchor(300, 100, 600, 80);
    expect(popoverPlace(wide, SIZE, VIEWPORT)).toEqual({ left: 300, top: 180 + POPOVER_GAP_PX });
  });

  it("goes above the anchor when neither side nor below has room", () => {
    const wide = anchor(300, 500, 600, 250);
    expect(popoverPlace(wide, SIZE, VIEWPORT)).toEqual({ left: 300, top: 500 - POPOVER_GAP_PX - 240 });
  });

  it("covers the anchor, inside the viewport, when no side has room", () => {
    const huge = anchor(-100, -100, 1400, 1000);
    expect(popoverPlace(huge, SIZE, VIEWPORT)).toEqual({ left: POPOVER_MARGIN_PX, top: POPOVER_MARGIN_PX });
  });

  it("keeps the right edge inside a narrow viewport when placed below the anchor", () => {
    const narrow = { width: 400, height: 800 };
    expect(popoverPlace(anchor(200, 100, 150), SIZE, narrow).left).toBe(400 - POPOVER_MARGIN_PX - 320);
  });

  it("starts at the margin when the popover is larger than the viewport", () => {
    const big = { width: 2000, height: 2000 };
    expect(popoverPlace(anchor(100, 200), big, VIEWPORT)).toEqual({ left: POPOVER_MARGIN_PX, top: POPOVER_MARGIN_PX });
  });
});
