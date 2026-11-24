import type { EntityRegistryEntry, EntityRegistryView } from "../hass/entity-registry";
import { isVacuumEntityId } from "../hass/entity-registry-entry";

/** The integration's registry `platform` (`docs/research/roomba-plus.md` « Entities the card needs »). */
export const PLATFORM = "roomba_plus";

/** The integration's name as its users see it: the manifest `name` (`manifest.json` at `v4.6.5`, checked 2026-11-24). */
export const INTEGRATION_NAME = "Roomba+";

/** One Roomba+ robot's registry entries, found without entity id patterns (ADR 0002 « Decision »). */
export interface RobotEntities {
  readonly vacuum: EntityRegistryEntry;
  /** Every floor plan entry, enabled or not, in registry order. */
  readonly floorPlans: readonly EntityRegistryEntry[];
  /** The rooms map entry when there is exactly one. */
  readonly roomsMap: EntityRegistryEntry | undefined;
  /** The cleaning mode select (mop robots) when there is exactly one. */
  readonly primeCleaningMode: EntityRegistryEntry | undefined;
  /** Whether the device has any cleaning mode select, so two of them are not read as none. */
  readonly hasCleaningModeSelect: boolean;
}

/**
 * One robot per `roomba_plus` entry of domain `vacuum`, disabled ones included, in registry order. Its other entities
 * are the `roomba_plus` entries of the same device (one device per robot, « Device link »), told apart by
 * `translation_key` and entity domain (`image` for plans, `select` for the cleaning mode); a vacuum without a device
 * has none. The entries hold `unique_id`s: they stay inside the adapter.
 */
export function findRobots(registry: EntityRegistryView): readonly RobotEntities[] {
  const entries = registry.byPlatform(PLATFORM);
  return entries.filter((entry) => isVacuumEntityId(entry.entityId)).map((vacuum) => robotOf(vacuum, entries));
}

function robotOf(vacuum: EntityRegistryEntry, entries: readonly EntityRegistryEntry[]): RobotEntities {
  const deviceId = vacuum.deviceId;
  const related = deviceId === null ? [] : entries.filter((e) => e !== vacuum && e.deviceId === deviceId);
  const withKey = (key: string, domain: string) =>
    related.filter((e) => e.translationKey === key && e.entityId.startsWith(`${domain}.`));
  const selects = withKey("prime_cleaning_mode", "select");
  return {
    vacuum,
    floorPlans: withKey("floor_plan", "image"),
    roomsMap: onlyOne(withKey("rooms_map", "image")),
    primeCleaningMode: onlyOne(selects),
    hasCleaningModeSelect: selects.length > 0,
  };
}

function onlyOne<T>(items: readonly T[]): T | undefined {
  return items.length === 1 ? items[0] : undefined;
}
