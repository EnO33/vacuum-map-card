import { MAX_TEXT_LENGTH, withinTextCap } from "./limits";

/**
 * A server message bounded for display: at most the text cap in UTF-16 code units, cut at a code point boundary. This
 * is the one place server text is cut on purpose: a fallback shown as text, never a value the card relies on.
 */
export function fallbackText(message: string): string {
  if (withinTextCap(message)) return message;
  let text = "";
  for (const codePoint of message) {
    if (text.length + codePoint.length > MAX_TEXT_LENGTH) break;
    text += codePoint;
  }
  return text;
}
