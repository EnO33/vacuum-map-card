import { isLocale, type Locale } from "./catalogs";

/**
 * The card's locale for a Home Assistant language code (`docs/research/ha-frontend.md` § 2): the code in lower case
 * (which covers the exact match, the card's codes being lower case), else the part before the first `-`, else English.
 * Anything that is not a string, read at the boundary, gives English.
 */
export function resolveLocale(language: unknown): Locale {
  if (typeof language !== "string") return "en";
  const code = language.toLowerCase();
  if (isLocale(code)) return code;
  const base = code.replace(/-.*$/s, "");
  return isLocale(base) ? base : "en";
}
