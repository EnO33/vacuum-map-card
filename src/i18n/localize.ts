import { CATALOGS, type Catalog, ENGLISH, type Locale, type MessageKey } from "./catalogs";

/** Values for `{name}` placeholders: plain text, often untrusted (room, floor and robot names). */
export type MessageParams = Readonly<Record<string, string>>;

/** A `{name}` placeholder. Global, so kept private: only `replace` and `matchAll` use it, which reset its position. */
const PLACEHOLDER = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/** The `{name}` placeholders of a template, in order; the catalogue parity test reads the same grammar through it. */
export function placeholders(template: string): string[] {
  return Array.from(template.matchAll(PLACEHOLDER), (match) => match[0]);
}

/**
 * The catalogue's string for `key`, else the English one, with each placeholder replaced in one pass: a value is
 * inserted as it is and never read again, so `<`, `&` or `{other}` in it stay literal. A placeholder without a value
 * becomes empty. The result is plain text: render it as text, never as markup.
 */
export function translate(catalog: Catalog, key: MessageKey, params: MessageParams = {}): string {
  const template = catalog[key] ?? ENGLISH[key];
  return template.replace(
    PLACEHOLDER,
    (_placeholder, name: string) => (Object.hasOwn(params, name) && params[name]) || "",
  );
}

/** The card's string for `key` in `locale` (see {@link translate}). */
export function localize(locale: Locale, key: MessageKey, params?: MessageParams): string {
  return translate(CATALOGS[locale], key, params);
}
