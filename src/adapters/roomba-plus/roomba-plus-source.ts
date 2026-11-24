import type { RoomSource, SourceRobot } from "../../app/ports/room-source";
import type { EntityRegistryView } from "../hass/entity-registry";
import type { FrontendHass } from "../hass/frontend-hass";
import { stateObjectOf } from "../hass/picture-state";
import { actionKindOf, deviceEntryOf } from "./action-kind";
import { classifyRoombaPlusError } from "./error-kinds";
import { findRobots, INTEGRATION_NAME, PLATFORM, type RobotEntities } from "./robot-entities";
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

/** A built robot and, compared by identity, the objects its maps and its action were read from. */
interface Built {
  readonly mapSources: readonly unknown[];
  readonly actionSources: readonly unknown[];
  readonly robot: SourceRobot;
}

/**
 * The Roomba+ `RoomSource` (ADR 0002). `robots()` returns the same array and robot objects while their sources keep
 * their identity: the registry list, the `hass.states` objects of each robot's rooms map and floor plans, and those its
 * action is read from (vacuum, cleaning mode select, `hass.devices` entry). A vacuum update that leaves the action as
 * it was (a cleaning run updates the vacuum every few seconds) keeps the robot. A change renews only its robot.
 */
export function createRoombaPlusSource({ registry, getHass }: RoombaPlusSourceOptions): RoomSource {
  const readRoomsMap = roomsMapReader(getHass);
  let version: ReturnType<EntityRegistryView["version"]>;
  let entities: readonly RobotEntities[] = [];
  let built = new Map<string, Built>();
  let robots = NO_ROBOTS;

  /** The robot of `entity`, reused when its sources are unchanged; `renewed` tells whether it is a new object. */
  const robotOf = (entity: RobotEntities, hass: FrontendHass): { robot: SourceRobot; renewed: boolean } => {
    const snapshot = () => hass;
    const mapSources = mapSourcesOf(entity, hass);
    const actionSources = actionSourcesOf(entity, hass);
    const previous = built.get(entity.vacuum.entityId);
    if (previous && sameSources(previous.mapSources, mapSources)) {
      const sameAction =
        sameSources(previous.actionSources, actionSources) || actionKindOf(entity, snapshot) === previous.robot.action;
      if (sameAction) {
        built.set(entity.vacuum.entityId, { ...previous, actionSources });
        return { robot: previous.robot, renewed: false };
      }
    }
    const robot = buildRobot(entity, snapshot, readRoomsMap);
    built.set(entity.vacuum.entityId, { mapSources, actionSources, robot });
    return { robot, renewed: true };
  };

  return {
    integration: PLATFORM,
    integrationName: INTEGRATION_NAME,
    loaded: () => registry.version() !== undefined,
    robots() {
      const current = registry.version();
      if (current === undefined) return NO_ROBOTS;
      if (current !== version) {
        version = current;
        entities = findRobots(registry);
        built = new Map();
      }
      const hass = getHass();
      const next = entities.map((entity) => robotOf(entity, hass));
      if (next.length !== robots.length || next.some((n) => n.renewed)) {
        robots = Object.freeze(next.map((n) => n.robot));
      }
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

/** The state objects the stored maps and the rooms map are read from. */
function mapSourcesOf(entity: RobotEntities, hass: FrontendHass): readonly unknown[] {
  const stateOf = (entityId: string) => stateObjectOf(hass.states, entityId);
  return [
    entity.roomsMap === undefined ? undefined : stateOf(entity.roomsMap.entityId),
    ...entity.floorPlans.map((floorPlan) => stateOf(floorPlan.entityId)),
  ];
}

/** The objects the action is read from: the vacuum and select states, and the device entry. */
function actionSourcesOf(entity: RobotEntities, hass: FrontendHass): readonly unknown[] {
  const select = entity.primeCleaningMode;
  return [
    stateObjectOf(hass.states, entity.vacuum.entityId),
    select === undefined ? undefined : stateObjectOf(hass.states, select.entityId),
    deviceEntryOf(hass.devices, entity.vacuum.deviceId),
  ];
}

function sameSources(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((source, i) => source === b[i]);
}
