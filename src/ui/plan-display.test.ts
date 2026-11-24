import { describe, expect, it } from "vitest";
import type { FloorModel, Plan } from "../app/floor-model/floor-model";
import type { PictureState } from "../domain/robot/stored-map";
import { planCount, planDisplaysOf } from "./plan-display";

function plan(imageEntityId: string, robot: string, pictureState: PictureState = "available"): Plan {
  return {
    robot,
    imageEntityId,
    pictureState,
    mapName: undefined,
    mapNumber: 1,
    placement: { kind: "no_floor", reasons: [] },
    content: { kind: "picture_only", reason: "no_clean_area" },
  };
}

const model: FloorModel = {
  loading: false,
  loadFailed: false,
  floors: [{ floorId: "ground_floor", name: "Ground floor", plan: plan("image.a", "vacuum.one") }],
  noFloor: [plan("image.b", "vacuum.two"), plan("image.c", "vacuum.two", "unavailable")],
  robots: [],
};

const names = new Map([["vacuum.one", "Robot one"]]);
const asked: string[] = [];
const adapters = {
  pictureUrl: (entityId: string) => {
    asked.push(entityId);
    return entityId === "image.a" ? `https://ha.invalid/${entityId}?token=1` : undefined;
  },
  display: { language: () => "en", robotName: (id: string) => names.get(id) },
};

describe("planDisplaysOf", () => {
  it("reads each shown plan's robot name, the entity id when it has none, and an available picture's URL only", () => {
    asked.length = 0;
    expect(planDisplaysOf(model, adapters)).toStrictEqual(
      new Map([
        ["image.a", { url: "https://ha.invalid/image.a?token=1", robotName: "Robot one" }],
        ["image.b", { url: undefined, robotName: "vacuum.two" }],
        ["image.c", { url: undefined, robotName: "vacuum.two" }],
      ]),
    );
    expect(asked).toStrictEqual(["image.a", "image.b"]);
  });
});

describe("planCount", () => {
  it("counts each floor's plan and the « no floor » group's", () => {
    expect(planCount(model)).toBe(3);
  });
});
