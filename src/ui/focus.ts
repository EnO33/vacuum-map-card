/** An element that can take the focus back: an HTML element or an SVG shape (a room). */
export type Focusable = HTMLElement | SVGElement;

/**
 * The element that has the focus, followed down through open shadow roots: `document.activeElement` alone stops at
 * the outermost shadow host (the card, or Home Assistant's own elements). `undefined` when nothing focusable has it.
 */
export function deepActiveElement(): Focusable | undefined {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active instanceof HTMLElement || active instanceof SVGElement ? active : undefined;
}
