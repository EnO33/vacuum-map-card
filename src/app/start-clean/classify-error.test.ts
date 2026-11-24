import { describe, expect, it } from "vitest";
import { FakeRoomSource } from "../../../test/fakes/fake-room-source";
import { MAX_TEXT_LENGTH } from "../../domain/text/limits";
import type { ServiceError } from "../ports/service-call";
import { type ClassifyContext, classifyCleanError, type ErrorSource } from "./classify-error";

/** The Roomba+-like fake, knowing two keys; the real table is Epic 4's. */
const fake = new FakeRoomSource({
  errorKinds: new Map([
    ["unknown_rooms", "room_not_found"],
    ["room_list_not_read", "room_list_not_loaded"],
  ]),
});
const [robot] = fake.robots();
if (!robot) throw new Error("the fake has robots");
const source: ErrorSource = { integration: fake.integration, classifyError: (error) => robot.classifyError(error) };

const path1: ClassifyContext = { path: 1, source };
const path2: ClassifyContext = { path: 2, source };
const no = (kind: string) => ({ kind, mayHaveStarted: "no" });
const unknown = { kind: "unknown", mayHaveStarted: "unknown" };

describe("classifyCleanError, core cases of ADR 0003 « Errors »", () => {
  it.each<[string, ServiceError, string]>([
    ["1, bad call data", { code: "invalid_format" }, "card_problem"],
    [
      "2, return_response sent",
      {
        code: "service_validation_error",
        translationDomain: "homeassistant",
        translationKey: "service_does_not_support_response",
      },
      "card_problem",
    ],
    [
      "3, robot lacks area cleaning",
      { code: "service_validation_error", translationDomain: "homeassistant", translationKey: "service_not_supported" },
      "no_area_cleaning",
    ],
    ["4, user not allowed", { code: "home_assistant_error", message: "Unauthorized" }, "not_allowed"],
    [
      "6, no mapping saved",
      { code: "service_validation_error", translationDomain: "vacuum", translationKey: "area_mapping_not_configured" },
      "rooms_not_linked",
    ],
    [
      "7, area not mapped (one area per call, so nothing started)",
      { code: "service_validation_error", translationDomain: "vacuum", translationKey: "areas_not_mapped" },
      "area_not_linked",
    ],
  ])("case %s", (_, error, kind) => {
    expect(classifyCleanError(error, path1)).toEqual(no(kind));
  });

  it("cases 5 and 9: unknown_error is also any crash, so unknown and possibly started, without its message", () => {
    for (const context of [path1, path2]) {
      expect(classifyCleanError({ code: "unknown_error", message: "KeyError: 'MapA_q1W2e3'" }, context)).toEqual(
        unknown,
      );
    }
  });

  it("case 10: the service is missing; Home Assistant on path 1, the integration on path 2", () => {
    const missing: ServiceError = {
      code: "not_found",
      translationDomain: "homeassistant",
      translationKey: "service_not_found",
    };
    expect(classifyCleanError(missing, path1)).toEqual(no("ha_lacks_area_cleaning"));
    expect(classifyCleanError(missing, path2)).toEqual(no("integration_not_ready"));
    expect(classifyCleanError({ code: "not_found" }, path1)).toEqual(no("ha_lacks_area_cleaning"));
    expect(classifyCleanError({ code: "not_found" }, path2)).toEqual(no("integration_not_ready"));
  });
});

describe("classifyCleanError, integration errors", () => {
  it.each(["service_validation_error", "home_assistant_error"])(
    "asks the source for its own domain, code %s",
    (code) => {
      const error: ServiceError = { code, translationDomain: "roomba_plus", translationKey: "unknown_rooms" };
      expect(classifyCleanError(error, path2)).toEqual(no("room_not_found"));
    },
  );

  it("never takes room_list_not_read for Unauthorized", () => {
    const error: ServiceError = {
      code: "home_assistant_error",
      message: "Unauthorized",
      translationDomain: "roomba_plus",
      translationKey: "room_list_not_read",
    };
    expect(classifyCleanError(error, path2)).toEqual(no("room_list_not_loaded"));
  });

  it("gives unknown, without its translated message, for a key the source does not know", () => {
    const error: ServiceError = {
      code: "service_validation_error",
      message: "Known rooms: Library",
      translationDomain: "roomba_plus",
      translationKey: "brand_new",
    };
    expect(classifyCleanError(error, path2)).toEqual(unknown);
  });

  it("asks the source only for its own domain", () => {
    const eager: ErrorSource = { integration: "roomba_plus", classifyError: () => "room_not_found" };
    const error: ServiceError = { code: "service_validation_error", translationDomain: "other", translationKey: "x" };
    expect(classifyCleanError(error, { path: 2, source: eager })).toEqual(unknown);
  });
});

describe("classifyCleanError, anything else", () => {
  it("gives unknown with a bounded text fallback", () => {
    const error: ServiceError = { code: "home_assistant_error", message: `Odd ${"x".repeat(300)}` };
    const result = classifyCleanError(error, path1);
    expect(result).toMatchObject(unknown);
    expect(result.fallbackMessage).toHaveLength(MAX_TEXT_LENGTH);
  });

  it("keeps no empty fallback", () => {
    expect(classifyCleanError({ code: "home_assistant_error", message: "" }, path1)).toEqual(unknown);
  });

  it.each<[string, ServiceError]>([
    ["a message that is not exactly Unauthorized", { code: "home_assistant_error", message: "unauthorized" }],
    [
      "Unauthorized with a key",
      { code: "home_assistant_error", message: "Unauthorized", translationDomain: "x", translationKey: "y" },
    ],
    ["unknown_error with a key", { code: "unknown_error", translationDomain: "x", translationKey: "y" }],
    [
      "a core key from another domain",
      { code: "service_validation_error", translationDomain: "other", translationKey: "areas_not_mapped" },
    ],
  ])("gives unknown for %s", (_, error) => {
    expect(classifyCleanError(error, path1).kind).toBe("unknown");
  });

  it.each(["__proto__", "constructor", "toString", "hasOwnProperty"])(
    "gives unknown for %s as code, domain or key",
    (name) => {
      for (const error of [
        { code: name },
        { code: "service_validation_error", translationDomain: name, translationKey: "areas_not_mapped" },
        { code: "service_validation_error", translationDomain: "vacuum", translationKey: name },
      ]) {
        expect(classifyCleanError(error, path1).kind).toBe("unknown");
      }
    },
  );

  it("keeps no server text for a known case", () => {
    const error: ServiceError = {
      code: "service_validation_error",
      message: "Known rooms: Library, MapA_q1W2e3",
      translationDomain: "vacuum",
      translationKey: "areas_not_mapped",
    };
    expect(classifyCleanError(error, path1)).toEqual(no("area_not_linked"));
  });
});
