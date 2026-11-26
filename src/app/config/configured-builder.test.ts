import { describe, expect, it } from "vitest";
import { FakeHass } from "../../../test/fakes/fake-hass";
import { FakeRoomSource } from "../../../test/fakes/fake-room-source";
import { createFloorModelBuilder } from "../floor-model/memo";
import { createConfiguredBuilder } from "./configured-builder";

const hass = new FakeHass();
const sources = [new FakeRoomSource()];

describe("createConfiguredBuilder", () => {
  it("gives the builder's model when the floors option is not set", () => {
    const build = createFloorModelBuilder();
    const model = build(hass, sources);
    expect(createConfiguredBuilder(build)(hass, sources, undefined)).toBe(model);
  });

  it("keeps only the listed floors and drops the no-floor group", () => {
    const model = createConfiguredBuilder(createFloorModelBuilder())(hass, sources, ["upper_floor"]);
    expect(model.floors.map((f) => f.floorId)).toStrictEqual(["upper_floor"]);
    expect(model.noFloor).toStrictEqual([]);
  });

  it("gives the same model object for the same inputs and list, and a new one for a new list", () => {
    const build = createConfiguredBuilder(createFloorModelBuilder());
    const floors = ["ground_floor"];
    const first = build(hass, sources, floors);
    expect(build(new FakeHass(), sources, floors)).toBe(first);
    expect(build(hass, sources, ["ground_floor"])).not.toBe(first);
  });
});
