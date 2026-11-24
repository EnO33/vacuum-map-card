import { describe, expect, it, vi } from "vitest";
import { FakeHass } from "../../../test/fakes/fake-hass";
import { FakeRoomSource } from "../../../test/fakes/fake-room-source";
import { withRobot } from "../../../test/helpers/sources";
import { solveCalibration } from "../../domain/geometry/affine";
import type { SourceRobot } from "../ports/room-source";
import { createFloorModelBuilder } from "./memo";

vi.mock("../../domain/geometry/affine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../domain/geometry/affine")>();
  return { ...actual, solveCalibration: vi.fn(actual.solveCalibration) };
});

const solves = () => vi.mocked(solveCalibration).mock.calls.length;

function newState(robot: SourceRobot): Partial<SourceRobot> {
  const roomsMap = robot.roomsMap;
  if (roomsMap?.content.kind !== "snapshot") throw new Error("expected a snapshot");
  const snapshot = { ...roomsMap.content.snapshot, state: "2026-01-01T10:00:00+00:00" };
  return { roomsMap: { ...roomsMap, content: { kind: "snapshot", snapshot } } };
}

describe("createFloorModelBuilder", () => {
  it("returns the same model for equal inputs held in new objects, and solves no calibration again", () => {
    const build = createFloorModelBuilder();
    const first = build(new FakeHass(), [new FakeRoomSource()]);
    const before = solves();
    expect(build(new FakeHass(), [new FakeRoomSource()])).toBe(first);
    expect(solves()).toBe(before);
  });

  it("re-solves only the robot whose rooms map state changed", () => {
    const build = createFloorModelBuilder();
    const first = build(new FakeHass(), [new FakeRoomSource()]);
    const before = solves();
    const second = build(new FakeHass(), [withRobot(new FakeRoomSource(), "vacuum.robot_one", newState)]);
    expect(solves()).toBe(before + 1);
    expect(second).not.toBe(first);
  });

  it("keeps the model when a robot only changes state, such as starting to clean", () => {
    const build = createFloorModelBuilder();
    const first = build(new FakeHass(), [new FakeRoomSource()]);
    const cleaning = new FakeHass();
    const vacuum = cleaning.vacuum.bind(cleaning);
    cleaning.vacuum = (entityId) => {
      const state = vacuum(entityId);
      return state && { ...state, state: "cleaning" };
    };
    expect(build(cleaning, [new FakeRoomSource()])).toBe(first);
  });

  it("changes the model on a floor reorder", () => {
    const build = createFloorModelBuilder();
    const hass = new FakeHass();
    const first = build(hass, [new FakeRoomSource()]);
    const reordered = [...(hass.floors() ?? [])].reverse();
    const second = build(new FakeHass({ floors: reordered }), [new FakeRoomSource()]);
    expect(second).not.toBe(first);
    expect(second.floors.map((f) => f.floorId)).toEqual(["upper_floor", "ground_floor"]);
  });

  it("changes the model on a new area alias", () => {
    const build = createFloorModelBuilder();
    const hass = new FakeHass();
    const first = build(hass, [new FakeRoomSource()]);
    const areas = new Map(hass.areas());
    const studio = areas.get("studio");
    if (!studio) throw new Error("the fixture has studio");
    areas.set("studio", { ...studio, aliases: ["Atelier"] });
    expect(build(new FakeHass({ areas }), [new FakeRoomSource()])).not.toBe(first);
  });

  it("does not solve again for a change that does not touch any rooms map", () => {
    const build = createFloorModelBuilder();
    build(new FakeHass(), [new FakeRoomSource()]);
    const before = solves();
    build(new FakeHass({ admin: true, floors: [] }), [new FakeRoomSource()]);
    expect(solves()).toBe(before);
  });
});
