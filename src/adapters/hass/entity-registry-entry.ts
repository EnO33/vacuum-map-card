import { jsonEqual } from "./json-equal";
import { boundedId, boundedText, isObject, ownValue } from "./own-property";

/**
 * One entry of `config/entity_registry/list` (`docs/research/ha-core-registries.md` « Read paths »), reduced to what
 * the card uses. Disabled and hidden entries are kept (« Gaps for this card », Epic 4, item 4).
 */
export interface EntityRegistryEntry {
  readonly entityId: string;
  /** The registry entry `id`, as in the `segments_changed_<id>` repair issue. */
  readonly registryId: string;
  readonly platform: string;
  readonly deviceId: string | null;
  readonly areaId: string | null;
  /** `true` for any non-null `disabled_by`, including `"hass"` and values the card does not know. */
  readonly disabled: boolean;
  readonly uniqueId: string | undefined;
  readonly translationKey: string | null;
  /** `vacuum.` entities only: the own `options.vacuum`, unparsed (parsed by the `HassPort` reader). */
  readonly rawVacuumOptions?: unknown;
}

/**
 * Reads one untrusted entry from its own data properties, or `undefined` when it has no string `entity_id`, `id` or
 * `platform` within the cap. Optional strings over the cap are dropped, never cut. `has_entity_name` and `hidden_by`
 * are never read (items 4 and 6).
 */
export function parseEntityRegistryEntry(raw: unknown): EntityRegistryEntry | undefined {
  if (!isObject(raw)) return undefined;
  const entityId = boundedText(ownValue(raw, "entity_id"));
  const registryId = boundedText(ownValue(raw, "id"));
  const platform = boundedText(ownValue(raw, "platform"));
  if (entityId === undefined || registryId === undefined || platform === undefined) return undefined;
  const disabledBy = ownValue(raw, "disabled_by");
  const entry: EntityRegistryEntry = {
    entityId,
    registryId,
    platform,
    deviceId: boundedText(ownValue(raw, "device_id")) ?? null,
    areaId: boundedId(ownValue(raw, "area_id")) ?? null,
    disabled: disabledBy !== undefined && disabledBy !== null,
    uniqueId: boundedText(ownValue(raw, "unique_id")),
    translationKey: boundedText(ownValue(raw, "translation_key")) ?? null,
  };
  return entityId.startsWith("vacuum.") ? { ...entry, rawVacuumOptions: vacuumOptionsOf(raw) } : entry;
}

function vacuumOptionsOf(raw: object): unknown {
  const options = ownValue(raw, "options");
  return isObject(options) ? ownValue(options, "vacuum") : undefined;
}

/** Every parsed field, `rawVacuumOptions` structurally. */
export function entryEqual(a: EntityRegistryEntry, b: EntityRegistryEntry): boolean {
  return (
    a.entityId === b.entityId &&
    a.registryId === b.registryId &&
    a.platform === b.platform &&
    a.deviceId === b.deviceId &&
    a.areaId === b.areaId &&
    a.disabled === b.disabled &&
    a.uniqueId === b.uniqueId &&
    a.translationKey === b.translationKey &&
    jsonEqual(a.rawVacuumOptions, b.rawVacuumOptions)
  );
}
