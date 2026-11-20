import { CARD_VERSION } from "../version";
import { CARD_DOCUMENTATION_URL, CARD_ELEMENT, CARD_NAME } from "./card-meta";
import { VacuumMapCard } from "./vacuum-map-card";

/** Entry of `window.customCards`, read by the Home Assistant card picker (frontend 20261028.6). */
export interface CustomCardEntry {
  readonly type: string;
  readonly name: string;
  readonly preview: boolean;
  readonly documentationURL: string;
}

function isEntryOfType(value: unknown, type: string): boolean {
  return typeof value === "object" && value !== null && "type" in value && value.type === type;
}

/**
 * Adds `entry` to the picker list once. The list may come from Home Assistant or other cards,
 * so it is untrusted: a non-array value is replaced by a new list, other items are kept as they are.
 * The entry is pushed into the existing array, never into a copy: the frontend keeps a reference to
 * the array it found when it loaded, and its card picker reads that reference
 * (`src/data/lovelace_custom_cards.ts`, frontend 20261028.6).
 */
export function withCustomCard(existing: unknown, entry: CustomCardEntry): unknown[] {
  const cards: unknown[] = Array.isArray(existing) ? existing : [];
  if (!cards.some((card) => isEntryOfType(card, entry.type))) {
    cards.push(entry);
  }
  return cards;
}

/** Defines the element unless the name is taken (the module may be loaded twice). Returns true when it defined it. */
export function defineOnce(registry: CustomElementRegistry, name: string, element: CustomElementConstructor): boolean {
  if (registry.get(name) !== undefined) {
    return false;
  }
  registry.define(name, element);
  return true;
}

/** Registers the card element, logs its version once, and lists it in the card picker. */
export function registerCard(): void {
  if (defineOnce(customElements, CARD_ELEMENT, VacuumMapCard)) {
    console.info(`${CARD_ELEMENT} ${CARD_VERSION}`);
  }
  window.customCards = withCustomCard(window.customCards, {
    type: CARD_ELEMENT,
    name: CARD_NAME,
    preview: false,
    documentationURL: CARD_DOCUMENTATION_URL,
  });
}
