import type { FloorModel } from "../app/floor-model/floor-model";
import { type ItemRef, itemName } from "../app/robots-for-item/robots-for-item";

/**
 * The selected item: `open` while the picker shows it, with its name once the model was seen to have it; `gone` once
 * the model lost an item it had (re-mapping), until the next selection.
 */
export type Selection =
  | { readonly kind: "none" }
  | { readonly kind: "open"; readonly item: ItemRef; readonly name?: string }
  | { readonly kind: "gone"; readonly name: string };

export const NO_SELECTION: Selection = Object.freeze({ kind: "none" });

/**
 * The selection in step with the model: an item it has gets its name; an item it no longer has ends the selection,
 * as `gone` when it was shown. An item the model never had is dropped without a message. Returns `selection` itself
 * when nothing changes.
 */
export function followModel(selection: Selection, model: FloorModel): Selection {
  if (selection.kind !== "open") return selection;
  const name = itemName(model, selection.item);
  if (name !== undefined) return name === selection.name ? selection : { ...selection, name };
  return selection.name === undefined ? NO_SELECTION : { kind: "gone", name: selection.name };
}
