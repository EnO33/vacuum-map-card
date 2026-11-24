import type { HassPort } from "../app/ports/hass-port";
import type { RoomSource } from "../app/ports/room-source";
import type { FrontendHass } from "./hass/frontend-hass";
import { createHassPort, type HassPortOptions } from "./hass/hass-port";
import { pictureUrl } from "./hass/picture-url";
import { createRoombaPlusSource } from "./roomba-plus/roomba-plus-source";

export type AdaptersOptions = HassPortOptions;

/** The one object the card wires (Epic 5): the ports `app` reads, the picture URL builder, and their lifecycle. */
export interface Adapters {
  readonly hass: HassPort;
  /** The room sources, the same array on every call; Roomba+ is the only one. */
  sources(): readonly RoomSource[];
  /** A plan picture's URL, only for an image a source reports; never cached (ADR 0005 « Plan pictures »). */
  pictureUrl(entityId: string): string | undefined;
  /** Fetches and follows the floor list, the entity registry list and the repair issues. */
  start(): void;
  /**
   * Releases every subscription and listener. The object is then spent: `start` does nothing, so a card that is
   * attached again makes a new one with `createAdapters`.
   */
  stop(): void;
}

/**
 * Composes the Home Assistant and Roomba+ adapters over the live frontend `hass`. The Roomba+ source reads the port's
 * own entity registry list, so the list is fetched once.
 */
export function createAdapters(getHass: () => FrontendHass, options: AdaptersOptions = {}): Adapters {
  const port = createHassPort(getHass, options);
  const sources: readonly RoomSource[] = Object.freeze([
    createRoombaPlusSource({ registry: port.entityRegistry, getHass }),
  ]);
  return {
    hass: portOnly(port),
    sources: () => sources,
    pictureUrl: (entityId) => pictureUrl(getHass, sources, entityId),
    start: () => port.start(),
    stop: () => port.stop(),
  };
}

/** The `HassPort` members only, so `app` and `ui` cannot reach the lifecycle or the registry entries at run time. */
function portOnly(port: HassPort): HassPort {
  const only: HassPort = {
    floors: () => port.floors(),
    areas: () => port.areas(),
    vacuum: (entityId) => port.vacuum(entityId),
    hasService: (domain, service) => port.hasService(domain, service),
    vacuumOptions: (entityId) => port.vacuumOptions(entityId),
    segmentsChangedOpen: (entityId) => port.segmentsChangedOpen(entityId),
    isAdmin: () => port.isAdmin(),
    callService: (call) => port.callService(call),
    subscribe: (listener) => port.subscribe(listener),
  };
  return Object.freeze(only);
}
