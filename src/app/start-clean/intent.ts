import type { ActionKind } from "../../domain/robot/action-kind";
import type { FloorModel } from "../floor-model/floor-model";
import type { HassPort } from "../ports/hass-port";
import type { RoomSource, SourceRobot } from "../ports/room-source";
import type { ServiceCall } from "../ports/service-call";
import { type Choice, type NotStartableReason, targetsRobot } from "../robots-for-item/choice";
import { outlinesOf } from "../robots-for-item/robot-context";
import { type ItemRef, robotsForItem } from "../robots-for-item/robots-for-item";
import { sourcedRobots } from "../robots-for-item/source-robots";

/** A rooms map as the intent keeps it: its `state` string and a projection of its rooms, never the state object. */
export interface RoomsMapProjection {
  readonly state: string;
  readonly rooms: readonly { readonly regionId: string; readonly name: string; readonly roomId: string }[];
}

export type PathIntent =
  | {
      readonly path: 1;
      readonly areaId: string;
      readonly roomNames: readonly string[];
      /** A value for linking only; never shown. */
      readonly mapId: string;
      /** The area's segments with the names the confirmation shows. */
      readonly segments: readonly { readonly segmentId: string; readonly name: string }[];
    }
  | {
      readonly path: 2;
      readonly regionId: string;
      readonly roomName: string;
      /** The paired map, when known; a value for linking only. */
      readonly mapId?: string;
      /** The call as the adapter described it (`RoomSource.roomAction`), for this robot. */
      readonly call: ServiceCall;
      /** The sending robot's own rooms map, whose region id is sent. */
      readonly roomsMap: RoomsMapProjection;
    };

/**
 * What the dialog shows and the card will send, captured when it opens (ADR 0003 « When the checks run »). Deeply
 * frozen; values only; no `access_token`, picture URL, state object or attributes. `roomsMap` is the item's own
 * rooms map for a room item.
 */
export interface Intent {
  readonly vacuumEntityId: string;
  readonly action: ActionKind;
  readonly item: ItemRef;
  readonly path: PathIntent;
  readonly roomsMap?: RoomsMapProjection;
}

export type PrepareResult =
  | { readonly kind: "intent"; readonly intent: Intent }
  | { readonly kind: "not_startable"; readonly reasons: readonly NotStartableReason[] }
  /** The item does not list this robot (or the item is not on a shown plan). */
  | { readonly kind: "not_listed" };

/** The intent for one robot on one item, from the model and the ports as they are now. */
export function intentOf(
  model: FloorModel,
  item: ItemRef,
  vacuumEntityId: string,
  hass: HassPort,
  sources: readonly RoomSource[],
): PrepareResult {
  const candidate = robotsForItem(model, item, hass, sources).find((c) => c.vacuumEntityId === vacuumEntityId);
  const robots = sourcedRobots(sources);
  const sender = robots.get(vacuumEntityId)?.robot;
  if (!candidate || !sender) return { kind: "not_listed" };
  const { choice } = candidate;
  if (choice.kind === "not_startable") return { kind: "not_startable", reasons: choice.reasons };
  const path = pathIntentOf(choice, sender, model);
  if (!path) return { kind: "not_startable", reasons: ["shadow_check_impossible"] };

  const owner = model.robots.find((r) => r.plans.some((p) => p.imageEntityId === item.imageEntityId));
  const ownerRobot = owner && robots.get(owner.vacuumEntityId)?.robot;
  const roomsMap = item.kind === "room" && ownerRobot ? projectionOf(ownerRobot) : undefined;
  const intent: Intent = {
    vacuumEntityId,
    action: candidate.action,
    item: itemOf(item),
    path,
    ...(roomsMap ? { roomsMap } : {}),
  };
  return { kind: "intent", intent: deepFreeze(structuredClone(intent)) };
}

/** The item as its fields only: a richer object passed by the UI never leaks into the intent. */
function itemOf(item: ItemRef): ItemRef {
  return item.kind === "room"
    ? { kind: "room", imageEntityId: item.imageEntityId, regionId: item.regionId }
    : { kind: "area", imageEntityId: item.imageEntityId, areaId: item.areaId };
}

/**
 * The path as the candidate decided it (#54). Path 2 is refused when the robot's own rooms map cannot be captured (its
 * names could not be checked then), or, as a last guard, when the call names another robot.
 */
function pathIntentOf(
  choice: Exclude<Choice, { kind: "not_startable" }>,
  sender: SourceRobot,
  model: FloorModel,
): PathIntent | undefined {
  if (choice.kind === "path1") {
    const { areaId, roomNames, mapId, segments } = choice;
    return { path: 1, areaId, roomNames, mapId, segments };
  }
  const roomsMap = projectionOf(sender);
  if (!roomsMap || !targetsRobot(choice.call, sender.vacuumEntityId)) return undefined;
  const robot = model.robots.find((r) => r.vacuumEntityId === sender.vacuumEntityId);
  const paired = robot && outlinesOf(robot)?.pairedRooms?.mapId;
  const path: Extract<PathIntent, { path: 2 }> = {
    path: 2,
    regionId: choice.regionId,
    roomName: choice.ownRoomName,
    call: choice.call,
    roomsMap,
  };
  return paired === undefined ? path : { ...path, mapId: paired };
}

function projectionOf(robot: SourceRobot): RoomsMapProjection | undefined {
  const content = robot.roomsMap?.content;
  if (content?.kind !== "snapshot") return undefined;
  const { state, rooms } = content.snapshot;
  return { state, rooms: rooms.map(({ regionId, name, roomId }) => ({ regionId, name, roomId })) };
}

/** Freezes plain data all the way down, so an intent cannot change after it was captured. */
function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
