/** Space between the popover and its anchor, in CSS pixels. */
export const POPOVER_GAP_PX = 8;
/** Space the popover keeps from the viewport's edges, in CSS pixels. */
export const POPOVER_MARGIN_PX = 8;

/** A box in viewport coordinates, as `getBoundingClientRect()` gives it. */
export interface AnchorBox {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface BoxSize {
  readonly width: number;
  readonly height: number;
}

export interface PopoverPosition {
  readonly left: number;
  readonly top: number;
}

/** `value` moved inside `[min, max]`; `min` wins when the range is empty (a popover larger than the viewport). */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/**
 * Where a popover of `size` goes next to `anchor` in a `viewport` (ADR 0004 « Robot picker »): right of the anchor,
 * else left of it, aligned with its top; when neither side has room, below it, else above it, aligned with its left
 * edge; when nothing has room, over it. Always inside the viewport, with a margin. Viewport coordinates, the same as a
 * top-layer element's containing block (`docs/research/ha-frontend.md` § 13).
 */
export function popoverPlace(anchor: AnchorBox, size: BoxSize, viewport: BoxSize): PopoverPosition {
  const maxLeft = viewport.width - POPOVER_MARGIN_PX - size.width;
  const maxTop = viewport.height - POPOVER_MARGIN_PX - size.height;
  const besideTop = clamp(anchor.top, POPOVER_MARGIN_PX, maxTop);
  const right = anchor.right + POPOVER_GAP_PX;
  if (right <= maxLeft) return { left: right, top: besideTop };
  const left = anchor.left - POPOVER_GAP_PX - size.width;
  if (left >= POPOVER_MARGIN_PX) return { left, top: besideTop };
  const alignedLeft = clamp(anchor.left, POPOVER_MARGIN_PX, maxLeft);
  const below = anchor.bottom + POPOVER_GAP_PX;
  if (below <= maxTop) return { left: alignedLeft, top: below };
  const above = anchor.top - POPOVER_GAP_PX - size.height;
  if (above >= POPOVER_MARGIN_PX) return { left: alignedLeft, top: above };
  return { left: alignedLeft, top: besideTop };
}
