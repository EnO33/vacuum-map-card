/** The open shadow root of an element under test; throws when it has none. */
export function shadowOf(element: Element): ShadowRoot {
  if (element.shadowRoot === null) throw new Error(`${element.localName} has no shadow root`);
  return element.shadowRoot;
}
