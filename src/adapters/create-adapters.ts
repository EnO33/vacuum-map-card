import type { HassPort } from "../app/ports/hass-port";
import type { RoomSource } from "../app/ports/room-source";
import type { Schedule } from "./hass/debounce";
import type { FrontendHass } from "./hass/frontend-hass";
import { createHassPort } from "./hass/hass-port";
import { pictureUrl } from "./hass/picture-url";
import { createRoombaPlusSource } from "./roomba-plus/roomba-plus-source";

export interface AdaptersOptions {
  /** The debounce timer of the fetched lists; `setTimeout` by default. */
  readonly schedule?: Schedule | undefined;
}

/** The one object the card wires (Epic 5): the ports `app` reads, the picture URL builder, and their lifecycle. */
export interface Adapters {
  readonly hass: HassPort;
  /** The room sources, the same array on every call; Roomba+ is the only one. */
  sources(): readonly RoomSource[];
  /** A plan picture's URL, only for an image a source reports; never cached (ADR 0005 « Plan pictures »). */
  pictureUrl(entityId: string): string | undefined;
  /** Fetches and follows the floor list, the entity registry list and the repair issues. Single use. */
  start(): void;
  /** Releases every subscription and listener. */
  stop(): void;
}

/**
 * Composes the Home Assistant and Roomba+ adapters over the live frontend `hass`. The Roomba+ source reads the port's
 * own entity registry list, so the list is fetched once.
 */
export function createAdapters(getHass: () => FrontendHass, options: AdaptersOptions = {}): Adapters {
  const port = createHassPort(getHass, { schedule: options.schedule });
  const sources: readonly RoomSource[] = Object.freeze([
    createRoombaPlusSource({ registry: port.entityRegistry, getHass }),
  ]);
  return {
    hass: port,
    sources: () => sources,
    pictureUrl: (entityId) => pictureUrl(getHass, sources, entityId),
    start: () => port.start(),
    stop: () => port.stop(),
  };
}
