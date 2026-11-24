import { describe, expect, it } from "vitest";
import { FakeRoomSource } from "../../../test/fakes/fake-room-source";
import type { RoomSource } from "../ports/room-source";
import { createConfiguredSources } from "./configured-sources";

const all: readonly RoomSource[] = Object.freeze([new FakeRoomSource()]);

function idsOf(sources: readonly RoomSource[]): readonly string[] {
  return sources.flatMap((source) => source.robots().map((robot) => robot.vacuumEntityId));
}

describe("createConfiguredSources", () => {
  it("gives every source as it is when the robots option is not set", () => {
    expect(
      createConfiguredSources(
        () => all,
        () => undefined,
      )(),
    ).toBe(all);
  });

  it("keeps only the listed robots", () => {
    const sources = createConfiguredSources(
      () => all,
      () => ["vacuum.robot_one"],
    );
    expect(idsOf(sources())).toStrictEqual(["vacuum.robot_one"]);
  });

  it("gives the same sources for the same list, and new ones when the list changes", () => {
    let robots: readonly string[] = ["vacuum.robot_one"];
    const sources = createConfiguredSources(
      () => all,
      () => robots,
    );
    const first = sources();
    expect(sources()).toBe(first);
    robots = ["vacuum.robot_two"];
    expect(sources()).not.toBe(first);
    expect(idsOf(sources())).toStrictEqual(["vacuum.robot_two"]);
  });
});
