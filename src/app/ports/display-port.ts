/**
 * What `ui` shows that only Home Assistant knows: the user's language and each robot's name. Implemented over `hass`
 * in the adapters, so no element reads `hass` itself (`CLAUDE.md` « Architecture »).
 */
export interface DisplayPort {
  /** The user's language code (`en`, `fr`, `pt-BR`…), or `undefined` when `hass` has none yet. */
  language(): string | undefined;
  /**
   * The robot's `friendly_name`, or `undefined` when it has none: `ui` then shows the entity id, as Home Assistant
   * does. Equal strings for an unchanged state, so `ui` can compare by value.
   */
  robotName(vacuumEntityId: string): string | undefined;
}
