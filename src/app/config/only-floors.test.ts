import { describe, expect, it } from "vitest";
import { FakeHass } from "../../../test/fakes/fake-hass";
import { FakeRoomSource } from "../../../test/fakes/fake-room-source";
import { buildFloorModel } from "../floor-model/build-floor-model";
import type { FloorModel } from "../floor-model/floor-model";
import { onlyFloors } from "./only-floors";

const model = buildFloorModel(new FakeHass(), [new FakeRoomSource()]);
const floorIds = (m: FloorModel) => m.floors.map((f) => f.floorId);

describe("onlyFloors", () => {
  it("has two floors and a « no floor » group on the fixtures", () => {
    expect(floorIds(model)).toStrictEqual(["ground_floor", "upper_floor"]);
    expect(model.noFloor.length).toBeGreaterThan(0);
  });

  it("gives the model itself when no floor is listed", () => {
    expect(onlyFloors(model, undefined)).toBe(model);
  });

  it("keeps the listed floors in the model's order, whatever the order of the list", () => {
    expect(floorIds(onlyFloors(model, ["upper_floor", "ground_floor"]))).toStrictEqual(["ground_floor", "upper_floor"]);
    expect(floorIds(onlyFloors(model, ["upper_floor"]))).toStrictEqual(["upper_floor"]);
  });

  it("ignores a listed floor that does not exist, or no longer does", () => {
    expect(floorIds(onlyFloors(model, ["deleted_floor", "upper_floor"]))).toStrictEqual(["upper_floor"]);
    expect(floorIds(onlyFloors(model, ["deleted_floor"]))).toStrictEqual([]);
  });

  it("drops the « no floor » group and keeps everything else", () => {
    const shown = onlyFloors(model, ["ground_floor"]);
    expect(shown.noFloor).toStrictEqual([]);
    expect(shown.robots).toBe(model.robots);
    expect(shown.loading).toBe(model.loading);
    expect(shown.loadFailed).toBe(model.loadFailed);
    expect(shown.floors[0]).toBe(model.floors[0]);
  });
});
