// Text limits from ADR 0002, amendment, « Parsing limits », item 3 (string caps).

/** Longest string kept from an integration, in UTF-16 code units; longer strings are unsupported, never cut. */
export const MAX_TEXT_LENGTH = 255;

/** The one place the cap is checked: UTF-16 code units, as `String.prototype.length` counts them. */
export function withinTextCap(s: string): boolean {
  return s.length <= MAX_TEXT_LENGTH;
}
