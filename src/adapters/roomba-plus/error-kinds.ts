import type { ServiceError } from "../../app/ports/service-call";
import type { IntegrationErrorKind } from "../../domain/robot/integration-error";
import { PLATFORM } from "./robot-entities";

/**
 * The Roomba+ refusals of ADR 0003 « Errors », all raised before the start command, by `translation_key`. A `Map`,
 * so `__proto__` or `toString` find nothing. Other keys stay unknown: adding one needs an ADR 0003 change.
 */
const KINDS: ReadonlyMap<string, IntegrationErrorKind> = new Map<string, IntegrationErrorKind>([
  ["not_smart_map", "no_room_map"],
  ["no_rooms_configured", "no_rooms_on_account"],
  ["no_rooms_resolved", "nothing_to_clean"],
  ["room_name_is_a_zone", "room_is_a_zone"],
  ["unknown_rooms", "room_not_found"],
  ["cloud_required", "cloud_account_required"],
  ["map_updating", "map_updating"],
  ["entity_not_found", "integration_not_ready"],
  ["config_entry_not_found", "integration_not_ready"],
  ["entry_not_loaded", "integration_not_ready"],
  ["rooms_different_floors", "rooms_on_different_maps"],
  ["no_valid_segments", "room_not_on_current_map"],
  ["room_list_not_read", "room_list_not_loaded"],
  ["room_map_unknown", "room_map_unknown"],
]);

/** The kind of a Roomba+ refusal, whatever its `code` (`room_list_not_read` comes as `home_assistant_error`). */
export function classifyRoombaPlusError(error: ServiceError): IntegrationErrorKind | undefined {
  if (error.translationDomain !== PLATFORM || error.translationKey === undefined) return undefined;
  return KINDS.get(error.translationKey);
}
