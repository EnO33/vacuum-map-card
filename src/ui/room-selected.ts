import type { ItemRef } from "../app/robots-for-item/robots-for-item";

/**
 * Fired by a plan picture when a room is chosen with Enter, Space or a tap, and by a room list's button; `detail` is
 * the item. It bubbles inside the card's shadow tree and never leaves the card (`composed: false`).
 */
export const ROOM_SELECTED_EVENT = "room-selected";

/** The event's class is its proof: only the card's own code builds one, so its `detail` needs no parsing. */
export class RoomSelectedEvent extends CustomEvent<ItemRef> {
  constructor(item: ItemRef) {
    super(ROOM_SELECTED_EVENT, { detail: item, bubbles: true, composed: false });
  }
}

/** The one way to build {@link ROOM_SELECTED_EVENT}, for a drawn room and for a listed area alike. */
export function roomSelectedEvent(item: ItemRef): RoomSelectedEvent {
  return new RoomSelectedEvent(item);
}
