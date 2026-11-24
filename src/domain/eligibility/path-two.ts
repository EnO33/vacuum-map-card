import type { LastSeen } from "../mapping/last-seen";
import type { PlanRoom } from "../plan/rooms-plan";
import { isPlainRegionId, shadowKeys } from "../text/shadow-key";

/** A room of a rooms plan as the shadow check reads it. */
export type PlanRoomName = Pick<PlanRoom, "regionId" | "name" | "roomId">;

/**
 * What path 2 reads from a robot; `app`'s `SourceRobot` (#47) has this shape. `C` is the adapter's call description
 * (`ServiceCall` in `app`): the domain only passes it on, never sends it.
 */
export interface PathTwoRobot<C> {
  roomAction(regionId: string): C | undefined;
  /** Whether the room action resolves names before ids, so the shadow check applies (Roomba+: yes). */
  readonly roomActionMatchesNamesFirst: boolean;
}

/**
 * The shadow keys (#44) of every name that could make the integration resolve a region id to another room, built
 * once per rooms plan: each room's `name` and `room_id`, owned by its region id, and each readable
 * `last_seen_segments` name, owned by no room (ADR 0003 « Path 2 »).
 */
export interface ShadowIndex {
  readonly owners: ReadonlyMap<string, ReadonlySet<string | undefined>>;
  /** The region ids of the plan the index was built from: a room of another plan is never checked against it. */
  readonly regionIds: ReadonlySet<string>;
  /** `false` when `last_seen_segments` cannot be read, so its names cannot be checked. */
  readonly complete: boolean;
}

/** Built from the rooms plan's room map (#45), keyed by region id, so region ids are unique by construction. */
export function shadowIndexOf(planRooms: ReadonlyMap<string, PlanRoomName>, lastSeen: LastSeen): ShadowIndex {
  const owners = new Map<string, Set<string | undefined>>();
  const add = (name: string, owner: string | undefined) => {
    for (const k of shadowKeys(name)) {
      const set = owners.get(k) ?? new Set<string | undefined>();
      set.add(owner);
      owners.set(k, set);
    }
  };
  for (const room of planRooms.values()) {
    add(room.name, room.regionId);
    add(room.roomId, room.regionId);
  }
  if (lastSeen.kind === "names") for (const name of lastSeen.names.values()) add(name, undefined);
  return { owners, regionIds: new Set(planRooms.keys()), complete: lastSeen.kind !== "unsupported" };
}

/** Why the room action is not offered, in the order checked (ADR 0003 « Path 2 »). Codes only. */
export type PathTwoRefusal = "region_id_unsafe" | "no_room_action" | "name_shadows_id" | "shadow_check_impossible";

export type PathTwo<C> =
  | { readonly kind: "path2"; readonly regionId: string; readonly call: C }
  | { readonly kind: "refused"; readonly reason: PathTwoRefusal };

/**
 * Whether the robot's own room action may be offered for a room of its rooms plan, when path 1 was refused. Not when
 * a name could make the integration resolve the region id to another room: another room's `name` or `room_id`, or a
 * `last_seen_segments` name, compared generously (`shadowKeys`, #44); matching too much only withdraws path 2. When the
 * last seen names cannot be read, path 2 is not offered whatever the integration (ADR 0002 « Parsing limits »
 * item 3); nor for a room the index was not built from.
 */
export function pathTwo<C>(robot: PathTwoRobot<C>, room: PlanRoomName, index: ShadowIndex): PathTwo<C> {
  const { regionId } = room;
  if (!isPlainRegionId(regionId)) return refused("region_id_unsafe");
  const call = robot.roomAction(regionId);
  if (call === undefined) return refused("no_room_action");
  if (robot.roomActionMatchesNamesFirst && shadowed(regionId, index)) return refused("name_shadows_id");
  if (!index.complete || !index.regionIds.has(regionId)) return refused("shadow_check_impossible");
  return { kind: "path2", regionId, call };
}

/** A key of the region id is also a key of a name owned by another room or by `last_seen_segments`. */
function shadowed(regionId: string, { owners }: ShadowIndex): boolean {
  for (const k of shadowKeys(regionId)) {
    for (const owner of owners.get(k) ?? []) if (owner !== regionId) return true;
  }
  return false;
}

function refused<C>(reason: PathTwoRefusal): PathTwo<C> {
  return { kind: "refused", reason };
}
