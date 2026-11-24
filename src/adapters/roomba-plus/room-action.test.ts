import { describe, expect, it } from "vitest";
import { MAX_TEXT_LENGTH } from "../../domain/text/limits";
import { roomActionOf } from "./room-action";

describe("roomActionOf", () => {
  const roomAction = roomActionOf("vacuum.robot_one");

  it("calls roomba_plus.clean_room with the entity and the region id only, no target", () => {
    expect(roomAction("1")).toStrictEqual({
      domain: "roomba_plus",
      service: "clean_room",
      data: { entity_id: "vacuum.robot_one", room_name: "1" },
    });
  });

  it.each<[string, string]>([
    ["an empty region id", ""],
    ["an over-cap region id", "r".repeat(MAX_TEXT_LENGTH + 1)],
  ])("is undefined for %s", (_, regionId) => {
    expect(roomAction(regionId)).toBeUndefined();
  });
});
