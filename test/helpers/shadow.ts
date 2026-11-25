import type { CSSResultOrNative } from "lit";

/** The open shadow root of an element under test; throws when it has none. */
export function shadowOf(element: Element): ShadowRoot {
  if (element.shadowRoot === null) throw new Error(`${element.localName} has no shadow root`);
  return element.shadowRoot;
}

/** The text of a Lit element class's styles, for tests that check a CSS rule. */
export function stylesText(element: { readonly elementStyles: readonly CSSResultOrNative[] }): string {
  return element.elementStyles.map((style) => ("cssText" in style ? style.cssText : "")).join("\n");
}
