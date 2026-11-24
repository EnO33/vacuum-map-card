import en from "./en.json";
import fr from "./fr.json";

/** A key of the card's strings. English is the reference catalogue, so an unknown key is a type error. */
export type MessageKey = keyof typeof en;

/** One locale's strings; a missing key falls back to English. */
export type Catalog = Readonly<Partial<Record<MessageKey, string>>>;

/** English, complete and the fallback of every other catalogue. */
export const ENGLISH: Readonly<Record<MessageKey, string>> = en;

/** The one list of the card's locales: adding a catalogue here adds the locale everywhere, its tests included. */
export const CATALOGS = { en, fr } as const satisfies Readonly<Record<string, Catalog>>;

/** A language the card ships strings for. */
export type Locale = keyof typeof CATALOGS;

export function isLocale(code: string): code is Locale {
  return Object.hasOwn(CATALOGS, code);
}
