import { boundedText } from "../hass/own-property";
import { PLATFORM } from "./robot-entities";

const UNIQUE_ID_PREFIX = `${PLATFORM}_`;

/**
 * A floor plan's `map_name` when it is safe to show (ADR 0002 « What an adapter reports » item 4), else `undefined`:
 * not a non-empty string within the cap (never cut), equal to the map id, or containing the robot identifier (both
 * case-insensitive). The identifier is the vacuum `unique_id` after `roomba_plus_`, or the whole `unique_id` without
 * that prefix; a Prime map name holds it (`docs/research/roomba-plus.md` « Floor plans »). An empty identifier hides
 * every name.
 */
export function safeMapName(raw: unknown, mapId: string, vacuumUniqueId: string): string | undefined {
  const name = boundedText(raw);
  if (name === undefined || name === "") return undefined;
  const lower = name.toLowerCase();
  if (lower === mapId.toLowerCase() || lower.includes(robotIdentifier(vacuumUniqueId).toLowerCase())) return undefined;
  return name;
}

function robotIdentifier(vacuumUniqueId: string): string {
  return vacuumUniqueId.startsWith(UNIQUE_ID_PREFIX) ? vacuumUniqueId.slice(UNIQUE_ID_PREFIX.length) : vacuumUniqueId;
}
