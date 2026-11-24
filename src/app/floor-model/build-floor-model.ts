import { groupByFloor, planShownOnFloor } from "../../domain/floors/floor-groups";
import { buildRoomsPlan } from "../../domain/plan/rooms-plan";
import type { HassPort } from "../ports/hass-port";
import type { RoomSource } from "../ports/room-source";
import type { FloorModel, FloorView, Plan } from "./floor-model";
import { type FloorModelInputs, readInputs } from "./inputs";
import { type RoomsPlanFor, robotModelOf } from "./robot-plans";

const buildEachTime: RoomsPlanFor = (_, snapshot) => buildRoomsPlan(snapshot);

/**
 * The floor model the UI renders (`docs/product.md` « Core flow » 1, ADR 0005): floors in `config/floor_registry/list`
 * order, each with one plan, then every plan on no floor; every robot with all its plans, shown or not. Reads only
 * the ports.
 */
export function buildFloorModel(hass: HassPort, sources: readonly RoomSource[]): FloorModel {
  return floorModelOf(readInputs(hass, sources), buildEachTime);
}

/** The floor model from inputs already read; `plansFor` lets the memo reuse rooms plans. */
export function floorModelOf(inputs: FloorModelInputs, plansFor: RoomsPlanFor): FloorModel {
  const floors = inputs.floors ?? [];
  const { areas } = inputs;
  const registry = { floors, areas, areaIds: new Set(areas.keys()) };
  const loading =
    inputs.floors === undefined ||
    inputs.robots.some(({ options }) => options.kind === "unsupported" && options.reason === "not_loaded");
  const robots = inputs.robots.map((robot) => robotModelOf(robot, registry, plansFor));
  const placed = robots
    .flatMap((robot) => robot.plans)
    .map((plan) => ({
      vacuumEntityId: plan.robot,
      planEntityId: plan.imageEntityId,
      floorId: plan.placement.kind === "floor" ? plan.placement.floorId : undefined,
      outlines: plan.content.kind === "outlines",
      plan,
    }));
  const floorViews: FloorView[] = [];
  let noFloor: Plan[] = [];
  for (const group of groupByFloor(floors, placed)) {
    if (group.kind === "no_floor") {
      noFloor = group.plans.map((p) => p.plan);
      continue;
    }
    const shown = planShownOnFloor(group.plans);
    if (shown) floorViews.push({ floorId: group.floor.floorId, name: group.floor.name, plan: shown.plan });
  }
  return { loading, floors: floorViews, noFloor, robots };
}
