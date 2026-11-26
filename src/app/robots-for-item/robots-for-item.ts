import { decideAreaItemPath, decideRoomPath } from "../../domain/eligibility/decide-path";
import { decideJoinPath, linksArea } from "../../domain/eligibility/join-path";
import type { ShadowIndex } from "../../domain/eligibility/path-two";
import { compareCodeUnits } from "../../domain/text/compare";
import type { FloorModel, Plan, RobotModel, RoomView } from "../floor-model/floor-model";
import type { HassPort } from "../ports/hass-port";
import type { RoomSource, SourceRobot } from "../ports/room-source";
import { areaItemChoice, type Candidate, type Choice, guardedCandidate, joinChoice, roomChoice } from "./choice";
import { type RobotContext, robotContextOf } from "./robot-context";
import { uniqueSourceRobots } from "./source-robots";

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
  const { owner, plan } = planOf(model, item.imageEntityId) ?? {};
  const ownerSource = owner && sourceOf.get(owner.vacuumEntityId);
  const found = plan && itemOn(plan, item);
  if (!owner || !plan || !found || !ownerSource) return [];
  const ownerContext = robotContextOf(owner, ownerSource, hass);
  const own = ownChoice(ownerContext, found);
  const first = candidateOf(ownerContext, own.choice);
  const { areaId } = own;
  if (areaId === undefined) return [guardedCandidate(first)];

  const planFloorId = plan.placement.kind === "floor" ? plan.placement.floorId : undefined;
  const others = model.robots
    .filter((robot) => robot !== owner)
    .sort((a, b) => compareCodeUnits(a.vacuumEntityId, b.vacuumEntityId))
    .flatMap((robot) => {
      const source = sourceOf.get(robot.vacuumEntityId);
      const candidate = source && joiningCandidate(robot, source, hass, areaId, planFloorId);
      return candidate ? [candidate] : [];
    });
  return [first, ...others].map(guardedCandidate);
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

/** The name of an item of the model, as the picker heads it; `undefined` when the model has no such item. */
export function itemName(model: FloorModel, item: ItemRef): string | undefined {
  const plan = planOf(model, item.imageEntityId)?.plan;
  const found = plan && itemOn(plan, item);
  return found?.kind === "room" ? found.view.room.name : found?.name;
}

/** The plan with this picture, and its robot. */
function planOf(model: FloorModel, imageEntityId: string): { owner: RobotModel; plan: Plan } | undefined {
  for (const owner of model.robots) {
    const plan = owner.plans.find((p) => p.imageEntityId === imageEntityId);
    if (plan) return { owner, plan };
  }
  return undefined;
}

/** An item as its plan has it: a room of the plan's outlines, or an area item of its room list. */
type FoundItem =
  | { readonly kind: "room"; readonly view: RoomView; readonly shadows: ShadowIndex }
  | { readonly kind: "area"; readonly areaId: string; readonly name: string };

function itemOn({ content }: Plan, item: ItemRef): FoundItem | undefined {
  if (item.kind === "area") {
    const found = content.kind === "areas" ? content.items.find((i) => i.areaId === item.areaId) : undefined;
    return found && { kind: "area", areaId: found.areaId, name: found.name };
  }
  if (content.kind !== "outlines") return undefined;
  const view = content.rooms.find((r) => r.room.regionId === item.regionId);
  return view && { kind: "room", view, shadows: content.shadows };
}

/** The plan's own robot's choice, and the item's area (its link on that plan, or the area item's area). */
function ownChoice(
  robot: RobotContext,
  found: FoundItem,
): { readonly choice: Choice; readonly areaId: string | undefined } {
  if (found.kind === "area") {
    const { areaId } = found;
    return { choice: areaItemChoice(decideAreaItemPath(robot.vacuum, areaId, robot.pathOne)), areaId };
  }
  const { view, shadows } = found;
  const context = { vacuum: robot.vacuum, pathOne: robot.pathOne, shadows };
  const choice = roomChoice(decideRoomPath(robot.source, view.room, context), view.room.name);
  return { choice, areaId: view.area.kind === "none" ? undefined : view.area.areaId };
}

function candidateOf(robot: RobotContext, choice: Choice): Candidate {
  const { vacuumEntityId, action } = robot.model;
  return { vacuumEntityId, action, state: robot.vacuum?.state, choice };
}
