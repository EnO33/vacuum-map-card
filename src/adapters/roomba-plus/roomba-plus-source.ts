import type { RoomSource, SourceRobot } from "../../app/ports/room-source";
import type { EntityRegistryView } from "../hass/entity-registry";
import type { FrontendHass } from "../hass/frontend-hass";
import { isObject, ownValue } from "../hass/own-property";
import { actionKindOf } from "./action-kind";
import { classifyRoombaPlusError } from "./error-kinds";
import { stateObjectOf } from "./picture-state";
import { findRobots, PLATFORM, type RobotEntities } from "./robot-entities";
import { roomActionOf } from "./room-action";
import { roomsMapReader } from "./rooms-map";
import { segmentLinks } from "./segments";
import { storedMapsOf } from "./stored-maps";

export interface RoombaPlusSourceOptions {
  /** The entity registry list, shared with `HassPort` (one fetch). */
  readonly registry: EntityRegistryView;
  readonly getHass: () => FrontendHass;
}

const NO_ROBOTS: readonly SourceRobot[] = Object.freeze([]);

/** A built robot and the source objects it was built from, compared by identity. */
interface Built {
  readonly sources: readonly unknown[];
  readonly robot: SourceRobot;
}

/**
 * The Roomba+ `RoomSource` (ADR 0002). `robots()` returns the same array and robot objects while their sources keep
 * their identity: the registry list, the `hass.states` objects of each robot's vacuum, rooms map, floor plans and
 * cleaning mode select, and its `hass.devices` entry. A change renews only the robot it belongs to.
 */
export function createRoombaPlusSource({ registry, getHass }: RoombaPlusSourceOptions): RoomSource {
  const readRoomsMap = roomsMapReader(getHass);
  let version: unknown;
  let entities: readonly RobotEntities[] = [];
  let built = new Map<string, Built>();
  let robots = NO_ROBOTS;
  return {
    integration: PLATFORM,
    robots() {
      const current = registry.version();
      if (current === undefined) return NO_ROBOTS;
      if (current !== version) {
        version = current;
        entities = findRobots(registry);
        built = new Map();
      }
      const hass = getHass();
      let renewed = entities.length !== robots.length;
      const next = entities.map((entity) => {
        const sources = sourcesOf(entity, hass);
        const previous = built.get(entity.vacuum.entityId);
        if (previous && sameSources(previous.sources, sources)) return previous.robot;
        renewed = true;
        const robot = buildRobot(entity, getHass, readRoomsMap);
        built.set(entity.vacuum.entityId, { sources, robot });
        return robot;
      });
      if (renewed) robots = Object.freeze(next);
      return robots;
    },
  };
}

function buildRobot(
  entity: RobotEntities,
  getHass: () => FrontendHass,
  readRoomsMap: ReturnType<typeof roomsMapReader>,
): SourceRobot {
  const storedMaps = Object.freeze(storedMapsOf(entity, getHass));
  const links = segmentLinks(storedMaps.map((map) => map.mapId));
  return Object.freeze({
    vacuumEntityId: entity.vacuum.entityId,
    action: actionKindOf(entity, getHass),
    storedMaps,
    roomsMap: readRoomsMap(entity),
    mapOfSegment: links.mapOfSegment,
    segmentOf: links.segmentOf,
    roomAction: roomActionOf(entity.vacuum.entityId),
    roomActionMatchesNamesFirst: true,
    classifyError: classifyRoombaPlusError,
  });
}

/** The objects a robot is built from, in a fixed order. */
function sourcesOf(entity: RobotEntities, hass: FrontendHass): readonly unknown[] {
  const stateOf = (entityId: string | undefined) =>
    entityId === undefined ? undefined : stateObjectOf(hass.states, entityId);
  const deviceId = entity.vacuum.deviceId;
  const devices = hass.devices;
  return [
    stateOf(entity.vacuum.entityId),
    stateOf(entity.roomsMap?.entityId),
    stateOf(entity.primeCleaningMode?.entityId),
    deviceId !== null && isObject(devices) ? ownValue(devices, deviceId) : undefined,
    ...entity.floorPlans.map((floorPlan) => stateOf(floorPlan.entityId)),
  ];
}

function sameSources(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((source, i) => source === b[i]);
}
