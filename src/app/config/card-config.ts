import { ownValue } from "../../domain/own-value";
import { MAX_TEXT_LENGTH, withinTextCap } from "../../domain/text/limits";

/**
 * The card's options (owner decision of 2026-11-24, #115), a public configuration API: a renamed or removed option
 * is a major version (`CONTRIBUTING.md` « Versioning »). `undefined` means not set: everything is discovered.
 */
export interface CardConfig {
  /** The `ha-card` header; no title, no header. */
  readonly title: string | undefined;
  /** Vacuum entity ids: only these robots give plans and can be picked. */
  readonly robots: readonly string[] | undefined;
  /** Floor ids: only these floors are shown, in Home Assistant's floor order, and the « no floor » group is not. */
  readonly floors: readonly string[] | undefined;
}

/** No option set: everything discovered, no header. */
export const NO_OPTIONS: CardConfig = Object.freeze({ title: undefined, robots: undefined, floors: undefined });

export type OptionName = keyof CardConfig;

/** The card's own keys, in the order the editor shows them; a test checks it lists every `CardConfig` key. */
export const OPTION_NAMES = ["title", "robots", "floors"] as const satisfies readonly OptionName[];

const OPTION_KEYS: ReadonlySet<string> = new Set(OPTION_NAMES);
const OPTIONS = `The options are ${OPTION_NAMES.slice(0, -1).join(", ")} and ${OPTION_NAMES.at(-1)}.`;

/** Whether `key` is one of the card's own options. */
export function isOptionName(key: string): key is OptionName {
  return OPTION_KEYS.has(key);
}

/**
 * Keys of every card's configuration that Home Assistant owns and passes to `setConfig` with the card's own
 * (`LovelaceCardConfig`, `docs/research/ha-frontend.md` § 8), and card-mod's: accepted and left to their owner.
 */
const HOME_ASSISTANT_KEYS: ReadonlySet<string> = new Set([
  "type",
  "index",
  "view_index",
  "view_layout",
  "layout_options",
  "grid_options",
  "visibility",
  "disabled",
  // card-mod, a widely used add-on that users put on every card (owner decision of 2026-11-26).
  "card_mod",
]);

/**
 * Home Assistant's entity id format (`VALID_ENTITY_ID`, core 2026.11.2 `homeassistant/core.py`) in the `vacuum`
 * domain: no double underscore anywhere, no underscore at either end of the object id.
 */
const VACUUM_ENTITY_ID = /^(?!.+__)vacuum\.(?!_)[0-9a-z_]+(?<!_)$/;

/**
 * The card's options from the dashboard configuration, which is untrusted. Throws an `Error` whose English message
 * names the wrong key and what it expects: Home Assistant shows it instead of the card, before the card knows the
 * user's language (`docs/research/ha-frontend.md` « Facts the card relies on »). Getters are never run; strings over
 * the cap are rejected, never cut. An option left empty (`null`, an empty list, a blank title) is not set.
 */
export function parseConfig(raw: unknown): CardConfig {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("The card's configuration must be options, such as title: Cleaning, not a list or a single value.");
  }
  for (const key of Object.keys(raw)) {
    if (!isOptionName(key) && !HOME_ASSISTANT_KEYS.has(key)) {
      const name = withinTextCap(key) ? JSON.stringify(key) : `(its name is longer than ${MAX_TEXT_LENGTH} characters)`;
      throw new Error(`Unknown option ${name}. ${OPTIONS}`);
    }
  }
  return Object.freeze({
    title: titleOf(ownValue(raw, "title")),
    robots: listOf(ownValue(raw, "robots"), ROBOTS),
    floors: listOf(ownValue(raw, "floors"), FLOORS),
  });
}

function titleOf(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "string" || !withinTextCap(value)) {
    throw new Error(`Option "title" must be text of at most ${MAX_TEXT_LENGTH} characters.`);
  }
  return value.trim() === "" ? undefined : value;
}

/** A list option: its key, what each entry is, an example entry for messages, and the entry check. */
interface ListOption {
  readonly key: string;
  readonly noun: string;
  readonly example: string;
  /** Whether a wrong entry's message shows the example: only when the format is checked. */
  readonly checked: boolean;
  valid(entry: string): boolean;
}

const ROBOTS: ListOption = {
  key: "robots",
  noun: "vacuum entity id",
  example: "vacuum.my_robot",
  checked: true,
  valid: (entry) => VACUUM_ENTITY_ID.test(entry),
};

const FLOORS: ListOption = {
  key: "floors",
  noun: "floor id",
  example: "ground_floor",
  checked: false,
  valid: (entry) => entry !== "",
};

/** A list of distinct strings that each pass the option's check, frozen; `undefined` when not set or empty. */
function listOf(value: unknown, { key, noun, example, checked, valid }: ListOption): readonly string[] | undefined {
  if (value === null || value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error(`Option "${key}" must be a list, one ${noun} per line, for example "- ${example}".`);
  }
  const entries: string[] = [];
  for (let i = 0; i < value.length; i++) {
    const entry = ownValue(value, String(i));
    if (typeof entry === "string" && !withinTextCap(entry)) {
      throw new Error(
        `Option "${key}": an entry is longer than ${MAX_TEXT_LENGTH} characters, so it is not a ${noun}.`,
      );
    }
    if (typeof entry !== "string" || !valid(entry)) {
      throw new Error(
        `Option "${key}": ${shown(entry)} is not a ${noun}${checked ? ` (for example ${example})` : ""}.`,
      );
    }
    if (entries.includes(entry)) throw new Error(`Option "${key}" lists ${JSON.stringify(entry)} more than once.`);
    entries.push(entry);
  }
  return entries.length === 0 ? undefined : Object.freeze(entries);
}

/** A wrong entry as the message shows it: a string or primitive as written, an object or list by its kind only. */
function shown(entry: unknown): string {
  if (Array.isArray(entry)) return "a list";
  if (typeof entry === "object" && entry !== null) return "an object";
  return typeof entry === "string" ? JSON.stringify(entry) : String(entry);
}
