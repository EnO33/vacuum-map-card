// A Roomba+-like `RoomSource` built from the anonymised fixtures of `test/fixtures/roomba-plus/`. Map ids and each
// robot's action are hard-coded from the fixtures' README. It follows two Roomba+ conventions recorded in the ADRs:
// the Classic segment id `<map id>_<region id>`, read back against the robot's own map ids (ADR 0002 item 2), and
// the `clean_room` call with the region id only (ADR 0003 « Path 2 »). Map name filtering, action detection and
// error key mapping are Epic 4's and are not reimplemented: error kinds and disabled floor plans come from settings.
import type { RoomSource, SourceRobot } from "../../src/app/ports/room-source";
import type { ActionKind } from "../../src/domain/robot/action-kind";
import type { IntegrationErrorKind } from "../../src/domain/robot/integration-error";
import type { StoredMap } from "../../src/domain/robot/stored-map";
import { withinTextCap } from "../../src/domain/text/limits";
import entityRegistry from "../fixtures/roomba-plus/entity_registry_list.json" with { type: "json" };
import floorPlanStates from "../fixtures/roomba-plus/hass_states_floor_plans.json" with { type: "json" };
import disabledFloorPlan from "../fixtures/roomba-plus/synthetic/entity_registry_list_floor_plan_disabled.json" with {
  type: "json",
};
import { snapshotFixtures, snapshotOf } from "../helpers/rooms-snapshot";

export interface FakeRoomSourceSettings {
  /** Use `synthetic/entity_registry_list_floor_plan_disabled.json`: the vacuum's second floor plan is disabled. */
  readonly disabledFloorPlans?: boolean;
  /** The error kinds this source knows, by `translation_key` of its own domain. */
  readonly errorKinds?: ReadonlyMap<string, IntegrationErrorKind>;
}

const INTEGRATION = "roomba_plus";

interface FakeRobot {
  readonly vacuumEntityId: string;
  readonly action: ActionKind;
  /** Floor plan entity id to map id, from the fixtures' README. */
  readonly maps: ReadonlyMap<string, string>;
  readonly roomsMapEntityId: string;
  readonly roomsFixture: keyof typeof snapshotFixtures;
}

const ROBOTS: readonly FakeRobot[] = [
  {
    vacuumEntityId: "vacuum.robot_one",
    action: "vacuum",
    maps: new Map([
      ["image.robot_one_floor_plan_mapa_q1w2e3", "MapA_q1W2e3"],
      ["image.robot_one_floor_plan_mapb_z9x8c7", "MapB_z9X8c7"],
    ]),
    roomsMapEntityId: "image.robot_one_rooms_map",
    roomsFixture: "vacuumAligned",
  },
  {
    vacuumEntityId: "vacuum.robot_two",
    action: "mop",
    maps: new Map([
      ["image.robot_two_floor_plan_mapc_k4l5m6", "MapC_k4L5m6"],
      ["image.robot_two_floor_plan_mapd_r7t8y9", "MapD_r7T8y9"],
    ]),
    roomsMapEntityId: "image.robot_two_rooms_map",
    roomsFixture: "mopPending",
  },
];

const floorPlanStateOf = new Map(Object.entries(floorPlanStates));

export class FakeRoomSource implements RoomSource {
  readonly integration = INTEGRATION;
  readonly #robots: readonly SourceRobot[];

  /** Robots are built once, so `robots()` keeps the same objects, as the port asks. */
  constructor(settings: FakeRoomSourceSettings = {}) {
    const registry = new Map(
      [...entityRegistry, ...(settings.disabledFloorPlans ? disabledFloorPlan : [])].map((e) => [e.entity_id, e]),
    );
    const storedMap = (floorPlanEntityId: string, mapId: string): StoredMap => {
      const entry = registry.get(floorPlanEntityId);
      const disabled = entry?.disabled_by != null;
      const state = disabled ? undefined : floorPlanStateOf.get(floorPlanEntityId);
      return {
        floorPlanEntityId,
        mapId,
        mapName: state?.attributes.map_name,
        pictureState: disabled ? "disabled" : state ? "available" : "unknown",
        ownAreaId: entry?.area_id ?? null,
      };
    };
    this.#robots = ROBOTS.map((robot) => ({
      vacuumEntityId: robot.vacuumEntityId,
      action: robot.action,
      storedMaps: [...robot.maps].map(([entityId, mapId]) => storedMap(entityId, mapId)),
      roomsMap: {
        imageEntityId: robot.roomsMapEntityId,
        shownMapId: undefined,
        pictureState: "available",
        content: { kind: "snapshot", snapshot: snapshotOf(snapshotFixtures[robot.roomsFixture]) },
      },
      mapOfSegment: (segmentId) => mapIdsLongestFirst(robot).find((mapId) => segmentId.startsWith(`${mapId}_`)),
      segmentOf: (mapId, regionId) => {
        const segmentId = `${mapId}_${regionId}`;
        return withinTextCap(segmentId) ? segmentId : undefined;
      },
      roomAction: (regionId) => ({
        domain: INTEGRATION,
        service: "clean_room",
        data: { entity_id: robot.vacuumEntityId, room_name: regionId },
      }),
      roomActionMatchesNamesFirst: true,
      classifyError: (error) =>
        error.translationDomain === INTEGRATION && error.translationKey !== undefined
          ? settings.errorKinds?.get(error.translationKey)
          : undefined,
    }));
  }

  robots(): readonly SourceRobot[] {
    return this.#robots;
  }
}

function mapIdsLongestFirst(robot: FakeRobot): string[] {
  return [...robot.maps.values()].sort((a, b) => b.length - a.length);
}
