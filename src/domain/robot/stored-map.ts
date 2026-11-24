/**
 * Whether a plan picture can be shown. `disabled` is a registry entry with `disabled_by` set: it exists only in the
 * registry, not in `hass.states` (ADR 0005 « Plan pictures »).
 */
export type PictureState = "available" | "unavailable" | "unknown" | "disabled";

/** One stored map of a robot: a floor plan registry entry, enabled or not. */
export interface StoredMap {
  readonly floorPlanEntityId: string;
  /** The integration's map id: opaque and sensitive, never logged, shown or put in a reason. */
  readonly mapId: string;
  /**
   * The map's name for a label, or `undefined` when it equals the map id, contains the robot identifier (ADR 0002
   * « What an adapter reports » item 4) or the entity has no state; a generic label is used then (Epic 5).
   */
  readonly mapName: string | undefined;
  readonly pictureState: PictureState;
  /** The floor plan entity's own registry `area_id`: map-to-floor source 1 (ADR 0005 « Map to floor »). */
  readonly ownAreaId: string | null;
}
