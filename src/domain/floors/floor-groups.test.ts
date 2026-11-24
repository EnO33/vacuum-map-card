import { describe, expect, it } from "vitest";
import floorRegistry from "../../../test/fixtures/ha-core/floor_registry_list.json" with { type: "json" };
import withBasement from "../../../test/fixtures/ha-core/synthetic/floor_registry_list_floor_without_areas.json" with {
  type: "json",
};
import { floorsOf } from "../../../test/helpers/registry";
import type { Floor } from "../registry/types";
import { type FloorGroup, groupByFloor, type PlacedPlan } from "./floor-groups";

function plan(vacuumEntityId: string, planEntityId: string, floorId?: string): PlacedPlan {
  return { vacuumEntityId, planEntityId, floorId };
}

/** Each group as `[floor id or "none", plan entity ids]`, for short expectations. */
function shape(groups: readonly FloorGroup<PlacedPlan>[]): [string, string[]][] {
  return groups.map((g) => [g.kind === "floor" ? g.floor.floorId : "none", g.plans.map((p) => p.planEntityId)]);
}

describe("groupByFloor", () => {
  it("keeps the floor list order and puts the « no floor » group last", () => {
    const plans = [
      plan("vacuum.robot_two", "image.d"),
      plan("vacuum.robot_one", "image.b", "upper_floor"),
      plan("vacuum.robot_one", "image.a", "ground_floor"),
      plan("vacuum.robot_two", "image.c", "ground_floor"),
    ];
    expect(shape(groupByFloor(floorsOf(floorRegistry), plans))).toEqual([
      ["ground_floor", ["image.a", "image.c"]],
      ["upper_floor", ["image.b"]],
      ["none", ["image.d"]],
    ]);
  });

  it("gives a floor without plans no group", () => {
    const plans = [plan("vacuum.robot_one", "image.a", "ground_floor")];
    expect(shape(groupByFloor(floorsOf(withBasement), plans))).toEqual([["ground_floor", ["image.a"]]]);
  });

  it("keeps a floor whose id is all digits where the list puts it", () => {
    const floors: Floor[] = [
      { floorId: "ground_floor", name: "Ground floor", aliases: [] },
      { floorId: "1", name: "1", aliases: [] },
    ];
    const plans = [plan("vacuum.robot_one", "image.b", "1"), plan("vacuum.robot_one", "image.a", "ground_floor")];
    expect(shape(groupByFloor(floors, plans)).map(([id]) => id)).toEqual(["ground_floor", "1"]);
  });

  it("sorts the « no floor » group by vacuum, then by plan, in code-unit order", () => {
    const plans = [
      plan("vacuum.robot_two", "image.b"),
      plan("vacuum.robot_one", "image.z"),
      plan("vacuum.robot_two", "image.a"),
      plan("vacuum.Robot_three", "image.m"),
    ];
    expect(shape(groupByFloor([], plans))).toEqual([["none", ["image.m", "image.z", "image.a", "image.b"]]]);
  });

  it("puts a plan whose floor is not in the list in the « no floor » group", () => {
    const plans = [plan("vacuum.robot_one", "image.a", "gone_floor")];
    expect(shape(groupByFloor(floorsOf(floorRegistry), plans))).toEqual([["none", ["image.a"]]]);
  });

  it("gives no group at all without plans", () => {
    expect(groupByFloor(floorsOf(floorRegistry), [])).toEqual([]);
  });
});
