import { decideAreaItemPath, decideRoomPath } from "../../domain/eligibility/decide-path";
import { decideJoinPath, linksArea } from "../../domain/eligibility/join-path";
import { compareCodeUnits } from "../../domain/text/compare";
import type { FloorModel, Plan, RobotModel } from "../floor-model/floor-model";
import type { HassPort } from "../ports/hass-port";
import type { RoomSource, SourceRobot } from "../ports/room-source";
import { areaItemChoice, type Candidate, type Choice, joinChoice, roomChoice } from "./choice";
import { type RobotContext, robotContextOf } from "./robot-context";

/** An item of a shown plan: a room of a rooms map, or an area item of a room list. */
export type ItemRef =
  | { readonly kind: "room"; readonly imageEntityId: string; readonly regionId: string }
  | { readonly kind: "area"; readonly imageEntityId: string; readonly areaId: string };

/**
 * The robots the picker lists for an item (`docs/product.md` « Core flow » 3): the plan's own robot first, then every
 * robot that joins through the item's area (`decideJoinPath`), by vacuum entity id in code-unit order. Each comes with
 * its action, its state and its path or why it cannot start. An item with no area lists only the plan's robot. A
 * vacuum id reported by two sources is never listed. `model` must come from the same `hass` read. Nothing is sent.
 */
export function robotsForItem(
  model: FloorModel,
  item: ItemRef,
  hass: HassPort,
  sources: readonly RoomSource[],
): readonly Candidate[] {
  const sourceOf = uniqueSourceRobots(sources);
  const owner = model.robots.find((robot) => robot.plans.some((plan) => plan.imageEntityId === item.imageEntityId));
  const plan = owner?.plans.find((p) => p.imageEntityId === item.imageEntityId);
  const ownerSource = owner && sourceOf.get(owner.vacuumEntityId);
  if (!owner || !plan || !ownerSource) return [];
  const ownerContext = robotContextOf(owner, ownerSource, hass);
  const own = ownChoice(ownerContext, plan, item);
  if (!own) return [];
  const first = candidateOf(ownerContext, own.choice);
  const { areaId } = own;
  if (areaId === undefined) return [first];

  const planFloorId = plan.placement.kind === "floor" ? plan.placement.floorId : undefined;
  const others = model.robots
    .filter((robot) => robot !== owner)
    .sort((a, b) => compareCodeUnits(a.vacuumEntityId, b.vacuumEntityId))
    .flatMap((robot) => {
      const source = sourceOf.get(robot.vacuumEntityId);
      const candidate = source && joiningCandidate(robot, source, hass, areaId, planFloorId);
      return candidate ? [candidate] : [];
    });
  return [first, ...others];
}

/** Another robot as a candidate when it joins through the area (`decideJoinPath`); ports are read only if linked. */
function joiningCandidate(
  robot: RobotModel,
  source: SourceRobot,
  hass: HassPort,
  areaId: string,
  planFloorId: string | undefined,
): Candidate | undefined {
  const hasAreaItem = robot.plans.some(
    (p) => p.content.kind === "areas" && p.content.items.some((i) => i.areaId === areaId),
  );
  if (!hasAreaItem && !robot.rooms.some((room) => linksArea(room, areaId))) return undefined;
  const { vacuum, pathOne, outlines } = robotContextOf(robot, source, hass);
  const decision = decideJoinPath(source, {
    vacuum,
    areaId,
    planFloorId,
    hasAreaItem,
    rooms: robot.rooms,
    pathOne,
    shadows: outlines?.shadows,
  });
  if (!decision) return undefined;
  // Path 2 always names one of the robot's own rooms; a missing name would break that invariant, so no candidate.
  const ownName = (regionId: string) => robot.rooms.find((room) => room.regionId === regionId)?.name;
  if (decision.kind === "path2" && ownName(decision.regionId) === undefined) return undefined;
  const choice = joinChoice(decision, (regionId) => ownName(regionId) ?? "");
  return { vacuumEntityId: robot.vacuumEntityId, action: robot.action, state: vacuum?.state, choice };
}

/** Source robots by vacuum id; an id reported by two sources is dropped, so rooms and actions never mix robots. */
function uniqueSourceRobots(sources: readonly RoomSource[]): ReadonlyMap<string, SourceRobot> {
  const counts = new Map<string, number>();
  const robots = sources.flatMap((source) => source.robots());
  for (const { vacuumEntityId } of robots) counts.set(vacuumEntityId, (counts.get(vacuumEntityId) ?? 0) + 1);
  return new Map(robots.filter((r) => counts.get(r.vacuumEntityId) === 1).map((r) => [r.vacuumEntityId, r]));
}

/** The plan's own robot's choice, and the item's area (its link on that plan, or the area item's area). */
function ownChoice(
  robot: RobotContext,
  plan: Plan,
  item: ItemRef,
): { readonly choice: Choice; readonly areaId: string | undefined } | undefined {
  const { content } = plan;
  if (item.kind === "area") {
    if (content.kind !== "areas" || !content.items.some((i) => i.areaId === item.areaId)) return undefined;
    return {
      choice: areaItemChoice(decideAreaItemPath(robot.vacuum, item.areaId, robot.pathOne)),
      areaId: item.areaId,
    };
  }
  if (content.kind !== "outlines") return undefined;
  const view = content.rooms.find((r) => r.room.regionId === item.regionId);
  if (!view) return undefined;
  const context = { vacuum: robot.vacuum, pathOne: robot.pathOne, shadows: content.shadows };
  const choice = roomChoice(decideRoomPath(robot.source, view.room, context), view.room.name);
  return { choice, areaId: view.area.kind === "none" ? undefined : view.area.areaId };
}

function candidateOf(robot: RobotContext, choice: Choice): Candidate {
  const { vacuumEntityId, action } = robot.model;
  return { vacuumEntityId, action, state: robot.vacuum?.state, choice };
}
