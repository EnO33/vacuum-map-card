import type { HassPort } from "../../app/ports/hass-port";
import { areasReader } from "./areas";
import { callService } from "./call-service";
import type { Schedule } from "./debounce";
import { createEntityRegistry, type EntityRegistry } from "./entity-registry";
import { createFloorList } from "./floors";
import type { FrontendHass } from "./frontend-hass";
import { Listeners } from "./listeners";
import { createRepairIssues, segmentsChangedReader } from "./repairs";
import { serviceReader } from "./services";
import { adminReader } from "./user";
import { vacuumOptionsReader } from "./vacuum-options";
import { vacuumReader } from "./vacuum-state";

export interface HassPortOptions {
  /** The debounce timer of the three lists; `setTimeout` by default. */
  readonly schedule?: Schedule | undefined;
}

/** `HassPort` with the lifecycle of the three lists it fetches itself. */
export interface LiveHassPort extends HassPort {
  /** Fetches and follows the floor list, the entity registry list and the repair issues. Single use. */
  start(): void;
  /** Releases every subscription; no listener is called afterwards. */
  stop(): void;
  /** The entity registry list, shared with the room sources (one fetch per port). */
  readonly entityRegistry: EntityRegistry;
}

/**
 * Every `HassPort` member over the live frontend `hass` (`src/app/ports/hass-port.ts`). Only three list commands are
 * sent through `callWS` and only their three update events are subscribed, all open to non-admin users (ADR 0005
 * « Permissions »).
 */
export function createHassPort(getHass: () => FrontendHass, options: HassPortOptions = {}): LiveHassPort {
  const { schedule } = options;
  const floors = createFloorList(getHass, schedule);
  const entityRegistry = createEntityRegistry(getHass, schedule);
  const issues = createRepairIssues(getHass, schedule);
  const lists = [floors, entityRegistry, issues];
  const listeners = new Listeners();
  for (const list of lists) list.onChange(() => listeners.notify());

  return {
    floors: () => floors.value(),
    areas: areasReader(getHass),
    vacuum: vacuumReader(getHass),
    hasService: serviceReader(getHass),
    vacuumOptions: vacuumOptionsReader(entityRegistry),
    segmentsChangedOpen: segmentsChangedReader(entityRegistry, issues),
    isAdmin: adminReader(getHass),
    callService: (call) => callService(getHass, call),
    subscribe: (listener) => listeners.add(listener),
    entityRegistry,
    start() {
      for (const list of lists) list.start();
    },
    stop() {
      listeners.clear();
      for (const list of lists) list.stop();
    },
  };
}
