import { describe, expect, it } from "vitest";
import type { ServiceError } from "../../app/ports/service-call";
import type { IntegrationErrorKind } from "../../domain/robot/integration-error";
import { MAX_TEXT_LENGTH } from "../../domain/text/limits";
import { classifyRoombaPlusError } from "./error-kinds";
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

describe("classifyRoombaPlusError", () => {
  const TABLE: readonly [string, IntegrationErrorKind][] = [
    ["not_smart_map", "no_room_map"],
    ["no_rooms_configured", "no_rooms_on_account"],
    ["no_rooms_resolved", "nothing_to_clean"],
    ["room_name_is_a_zone", "room_is_a_zone"],
    ["unknown_rooms", "room_not_found"],
    ["cloud_required", "cloud_account_required"],
    ["map_updating", "map_updating"],
    ["entity_not_found", "integration_not_ready"],
    ["config_entry_not_found", "integration_not_ready"],
    ["entry_not_loaded", "integration_not_ready"],
    ["rooms_different_floors", "rooms_on_different_maps"],
    ["no_valid_segments", "room_not_on_current_map"],
    ["room_list_not_read", "room_list_not_loaded"],
    ["room_map_unknown", "room_map_unknown"],
  ];

  const error = (translationKey: string | undefined, overrides: Partial<ServiceError> = {}): ServiceError => ({
    code: "service_validation_error",
    translationDomain: "roomba_plus",
    ...(translationKey === undefined ? {} : { translationKey }),
    ...overrides,
  });

  it.each(TABLE)("maps %s to %s", (key, kind) => {
    expect(classifyRoombaPlusError(error(key))).toBe(kind);
  });

  it("reads the key whatever the code", () => {
    expect(classifyRoombaPlusError(error("room_list_not_read", { code: "home_assistant_error" }))).toBe(
      "room_list_not_loaded",
    );
  });

  it("reaches every kind", () => {
    const every: Record<IntegrationErrorKind, true> = {
      no_room_map: true,
      no_rooms_on_account: true,
      nothing_to_clean: true,
      room_is_a_zone: true,
      room_not_found: true,
      cloud_account_required: true,
      map_updating: true,
      integration_not_ready: true,
      rooms_on_different_maps: true,
      room_not_on_current_map: true,
      room_list_not_loaded: true,
      room_map_unknown: true,
    };
    expect(new Set(TABLE.map(([key]) => classifyRoombaPlusError(error(key))))).toStrictEqual(
      new Set(Object.keys(every)),
    );
  });

  it.each<[string, ServiceError]>([
    ["an unknown key", error("room_name_and_room_passes_conflict")],
    ["__proto__", error("__proto__")],
    ["toString", error("toString")],
    ["a missing key", error(undefined)],
    ["another domain", error("unknown_rooms", { translationDomain: "vacuum" })],
    ["no domain", { code: "home_assistant_error", translationKey: "unknown_rooms" }],
  ])("gives undefined for %s", (_, serviceError) => {
    expect(classifyRoombaPlusError(serviceError)).toBeUndefined();
  });
});
