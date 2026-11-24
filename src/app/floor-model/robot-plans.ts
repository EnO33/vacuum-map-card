import { floorOfStoredMap, type MapFloor } from "../../domain/floors/map-to-floor";
import { type AreaMappingResult, readAreaMapping } from "../../domain/mapping/area-mapping";
import { type LastSeen, readLastSeen } from "../../domain/mapping/last-seen";
import { type Pairing, pairRoomsMap } from "../../domain/plan/pairing";
import { roomListOf } from "../../domain/plan/room-list";
import { areaOfRoom } from "../../domain/plan/room-to-area";
import type { RoomsMapSnapshot } from "../../domain/plan/rooms-map-snapshot";
import type { RoomsPlan, RoomsPlanResult } from "../../domain/plan/rooms-plan";
import type { Area, Floor } from "../../domain/registry/types";
import { supportsCleanArea } from "../../domain/robot/features";
import type { StoredMap } from "../../domain/robot/stored-map";
import { unsupported } from "../../domain/unsupported";
import type { OptionsList } from "../ports/hass-port";
import type { RoomsMap } from "../ports/room-source";
import type { Placement, Plan, RobotModel, RobotRoom, RoomsMapIssue } from "./floor-model";
import type { RobotInputs } from "./inputs";

/** The registry data every robot is read against, with the known area ids built once. */
export interface Registry {
  readonly floors: readonly Floor[];
  readonly areas: ReadonlyMap<string, Area>;
  readonly areaIds: ReadonlySet<string>;
}

/** Builds (or returns a cached) rooms plan for a robot's snapshot; the memo caches it by value. */
export type RoomsPlanFor = (vacuumEntityId: string, snapshot: RoomsMapSnapshot) => RoomsPlanResult;

/** One robot's plans: its rooms map (paired or not), its stored maps, and why its rooms map adds no plan. */
export function robotModelOf(inputs: RobotInputs, registry: Registry, plansFor: RoomsPlanFor): RobotModel {
  const { robot } = inputs;
  const id = robot.vacuumEntityId;
  const hasState = inputs.supportedFeatures !== undefined;
  const hasCleanArea = supportsCleanArea(inputs.supportedFeatures ?? 0);
  const { mapping, lastSeen } = optionsOf(inputs, registry.areaIds);
  const context = { ...registry, mapping, hasCleanArea, mapOfSegment: (s: string) => robot.mapOfSegment(s) };
  const floorOf = cached((map: StoredMap) => floorOfStoredMap(map, context));
  const storedPlans = () =>
    robot.storedMaps.map(
      (map): Plan => ({
        robot: id,
        imageEntityId: map.floorPlanEntityId,
        pictureState: map.pictureState,
        placement: toPlacement(floorOf(map)),
        content: roomListOf(map, context, context),
      }),
    );
  const base = { vacuumEntityId: id, action: robot.action, hasCleanArea, hasState };

  const outlines = outlinesOf(robot.roomsMap, (snapshot) => plansFor(id, snapshot));
  if (outlines.kind !== "plan") return { ...base, plans: storedPlans(), rooms: [], roomsMapIssue: outlines };
  const pairing = pairRoomsMap(robot, { mapping, lastSeen, floorOf });
  const { plan: roomsMapPlan, rooms } = outlinesPlan(id, outlines.roomsMap, outlines.plan, pairing, context);
  const plans = pairing.kind === "paired" ? [roomsMapPlan] : [roomsMapPlan, ...storedPlans()];
  return { ...base, plans, rooms, roomsMapIssue: undefined };
}

/** `compute` called at most once per key: pairing and the stored map plans share one floor link per map. */
function cached<K, V>(compute: (key: K) => V): (key: K) => V {
  const values = new Map<K, V>();
  return (key) => {
    const known = values.get(key);
    if (known !== undefined) return known;
    const value = compute(key);
    values.set(key, value);
    return value;
  };
}

/** `options.vacuum` read through #46; a list the port could not give is `unreadable`, never `absent`. */
function optionsOf(
  { options }: RobotInputs,
  areaIds: ReadonlySet<string>,
): { readonly mapping: AreaMappingResult; readonly lastSeen: LastSeen } {
  if (options.kind !== "options") return { mapping: unsupported("unreadable"), lastSeen: unsupported("unreadable") };
  const { areaMapping, lastSeenSegments } = options;
  return {
    mapping:
      areaMapping.kind === "unsupported" ? unsupported("unreadable") : readAreaMapping(listOf(areaMapping), areaIds),
    lastSeen:
      lastSeenSegments.kind === "unsupported" ? unsupported("unreadable") : readLastSeen(listOf(lastSeenSegments)),
  };
}

function listOf<T>(list: Exclude<OptionsList<T>, { kind: "unsupported" }>): T | undefined {
  return list.kind === "list" ? list.list : undefined;
}

/** The rooms map's plan, or why it adds none (`buildRoomsPlan` applied first, as #49 asks). */
function outlinesOf(
  roomsMap: RoomsMap | undefined,
  plansFor: (snapshot: RoomsMapSnapshot) => RoomsPlanResult,
): { readonly kind: "plan"; readonly roomsMap: RoomsMap; readonly plan: RoomsPlan } | RoomsMapIssue {
  if (roomsMap === undefined) return { kind: "absent" };
  const { content } = roomsMap;
  if (content.kind !== "snapshot") return content;
  const plan = plansFor(content.snapshot);
  return plan.kind === "plan" ? { kind: "plan", roomsMap, plan } : plan;
}

function outlinesPlan(
  robot: string,
  roomsMap: RoomsMap,
  plan: RoomsPlan,
  pairing: Pairing,
  context: Registry & { readonly mapping: AreaMappingResult },
): { readonly plan: Plan; readonly rooms: readonly RobotRoom[] } {
  const placement = placementOf(pairing);
  const floorId = placement.kind === "floor" ? placement.floorId : undefined;
  const segmentIdOf = pairing.kind === "paired" ? pairing.segmentIdOf : undefined;
  const views = [...plan.rooms.values()].map((room) => ({
    room,
    area: areaOfRoom(room, { ...context, planFloorId: floorId, segmentIdOf }),
  }));
  const { imageEntityId, pictureState } = roomsMap;
  const rooms = views.map(({ room, area }) => ({
    imageEntityId,
    regionId: room.regionId,
    name: room.name,
    area,
    floorId,
  }));
  return {
    plan: { robot, imageEntityId, pictureState, placement, content: { kind: "outlines", plan, rooms: views } },
    rooms,
  };
}

function placementOf(pairing: Pairing): Placement {
  if (pairing.kind !== "no_rooms_map") return toPlacement(pairing.placement);
  // `no_rooms_map` cannot reach here: `robotModelOf` pairs only a rooms map whose snapshot gave a plan.
  /* v8 ignore next */
  return { kind: "no_floor", reasons: ["cannot_tell_shown_map"] };
}

/** A floor link (#48) or an unpaired rooms map's placement (#49), without the source of the link. */
function toPlacement(placement: Placement | MapFloor): Placement {
  return placement.kind === "floor" ? { kind: "floor", floorId: placement.floorId } : placement;
}
