/**
 * Why an integration refused a start, one kind per row of ADR 0003 « Errors », Roomba+ table, named neutrally so the
 * card's text does not depend on one integration's keys. Each adapter maps its own keys to these (Epic 4); a key it
 * does not know gives no kind, and the card falls back to the core cases.
 */
export type IntegrationErrorKind =
  /** The robot has no room map (Roomba+ `not_smart_map`). */
  | "no_room_map"
  /** The robot's account lists no room yet (`no_rooms_configured`). */
  | "no_rooms_on_account"
  /** Nothing to clean was sent, a card problem (`no_rooms_resolved`). */
  | "nothing_to_clean"
  /** The target is a zone, not a room (`room_name_is_a_zone`). */
  | "room_is_a_zone"
  /** The robot could not find the room, or found it on several maps (`unknown_rooms`). */
  | "room_not_found"
  /** Room cleaning needs the vendor account in the integration (`cloud_required`). */
  | "cloud_account_required"
  /** The robot is rebuilding its map (`map_updating`). */
  | "map_updating"
  /** The integration is not ready for this robot (`entity_not_found`, `config_entry_not_found`, `entry_not_loaded`). */
  | "integration_not_ready"
  /** The rooms are on different maps (`rooms_different_floors`). */
  | "rooms_on_different_maps"
  /** The robot's current map does not contain the room (`no_valid_segments`). */
  | "room_not_on_current_map"
  /** The robot's room list is not loaded yet (`room_list_not_read`). */
  | "room_list_not_loaded"
  /** The robot does not know which map the room is on (`room_map_unknown`). */
  | "room_map_unknown";
