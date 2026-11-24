import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { FakeFrontendHass } from "../../../test/fakes/frontend-hass";
import serviceErrors from "../../../test/fixtures/ha-core/synthetic/service_errors.json" with { type: "json" };
import type { ServiceCall, ServiceResult } from "../../app/ports/service-call";
import { MAX_TEXT_LENGTH } from "../../domain/text/limits";
import { callService } from "./call-service";

const cleanArea: ServiceCall = {
  domain: "vacuum",
  service: "clean_area",
  data: { cleaning_area_id: ["library"] },
  target: { entity_id: "vacuum.robot_one" },
};
const cleanRoom: ServiceCall = {
  domain: "roomba_plus",
  service: "clean_room",
  data: { entity_id: "vacuum.robot_one", room_name: "1" },
};

/** Calls once on a fake answering with `value`, and asserts the call was sent exactly once, never retried. */
async function failingWith(value: unknown, kind: "reject" | "throw" = "reject"): Promise<ServiceResult> {
  const hass = new FakeFrontendHass();
  hass.behaviour = { kind, value };
  const result = await callService(() => hass, cleanArea);
  expect(hass.calls).toHaveLength(1);
  return result;
}

const methods: ("log" | "info" | "warn" | "error" | "debug")[] = ["log", "info", "warn", "error", "debug"];
let spies: MockInstance[] = [];

beforeEach(() => {
  spies = methods.map((method) => vi.spyOn(console, method));
});

afterEach(() => {
  // Nothing is logged on any path.
  for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

describe("callService", () => {
  it("reads the live hass on every call, sending once with notifyOnError and returnResponse false", async () => {
    const first = new FakeFrontendHass();
    const second = new FakeFrontendHass();
    let current = first;
    const getHass = () => current;
    await callService(getHass, cleanArea);
    current = second;
    await callService(getHass, cleanArea);
    const args = [
      "vacuum",
      "clean_area",
      { cleaning_area_id: ["library"] },
      { entity_id: "vacuum.robot_one" },
      false,
      false,
    ];
    expect(first.calls).toStrictEqual([args]);
    expect(second.calls).toStrictEqual([args]);
  });

  it("passes an undefined target when the call has none", async () => {
    const hass = new FakeFrontendHass();
    await callService(() => hass, cleanRoom);
    expect(hass.calls).toStrictEqual([
      ["roomba_plus", "clean_room", { entity_id: "vacuum.robot_one", room_name: "1" }, undefined, false, false],
    ]);
  });

  it("gives ok for any resolved value, never reading the response", async () => {
    const hass = new FakeFrontendHass();
    const response = {
      get context(): never {
        throw new Error("read");
      },
    };
    hass.behaviour = { kind: "resolve", value: response };
    await expect(callService(() => hass, cleanArea)).resolves.toEqual({ ok: true });
    expect(hass.calls).toHaveLength(1);
  });
});

describe("the ServiceError of each fixture row", () => {
  it.each(serviceErrors.map((r) => [r.row, r.error, r.expected]))("%s", async (_, error, expected) => {
    await expect(failingWith(error)).resolves.toStrictEqual({ ok: false, error: expected });
  });

  it("never copies the placeholders of a translated error", async () => {
    const unknownRooms = serviceErrors.find((r) => r.row.startsWith("Roomba+ unknown_rooms"));
    expect(JSON.stringify(await failingWith(unknownRooms?.error))).not.toMatch(/Larder|Snug|Orangery|Atelier/);
  });
});

describe("callService never rejects", () => {
  it.each<[string, unknown]>([
    ["a string", "boom"],
    ["null", null],
    ["undefined", undefined],
    ["a function", () => "boom"],
  ])("turns %s into unknown_error", async (_, value) => {
    await expect(failingWith(value)).resolves.toStrictEqual({ ok: false, error: { code: "unknown_error" } });
  });

  it("keeps an Error's own untranslated message, with unknown_error", async () => {
    await expect(failingWith(new Error("boom"))).resolves.toStrictEqual({
      ok: false,
      error: { code: "unknown_error", message: "boom" },
    });
  });

  it("catches a synchronous throw", async () => {
    const unauthorized = { code: "home_assistant_error", message: "Unauthorized" };
    await expect(failingWith(unauthorized, "throw")).resolves.toStrictEqual({ ok: false, error: unauthorized });
  });

  it("never runs a getter of the rejection value", async () => {
    const getter = vi.fn(() => "home_assistant_error");
    const accessor = Object.defineProperty({}, "code", { get: getter, enumerable: true });
    await expect(failingWith(accessor)).resolves.toStrictEqual({ ok: false, error: { code: "unknown_error" } });
    expect(getter).not.toHaveBeenCalled();
  });

  const throwingDescriptor = () =>
    new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          throw new Error("trap");
        },
      },
    );
  const revoked = () => {
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();
    return proxy;
  };

  it.each<[string, () => unknown]>([
    ["a proxy whose descriptor trap throws", throwingDescriptor],
    ["a revoked proxy", revoked],
  ])("gives unknown_error for %s", async (_, make) => {
    await expect(failingWith(make())).resolves.toStrictEqual({ ok: false, error: { code: "unknown_error" } });
  });
});

describe("the ServiceError rules", () => {
  it("keeps the message when translation_key is null", async () => {
    const odd = { code: "home_assistant_error", message: "Odd", translation_key: null };
    await expect(failingWith(odd)).resolves.toStrictEqual({
      ok: false,
      error: { code: "home_assistant_error", message: "Odd" },
    });
  });

  it("drops over-cap strings, never cuts them", async () => {
    const long = "x".repeat(MAX_TEXT_LENGTH + 1);
    await expect(failingWith({ code: long, message: "m" })).resolves.toStrictEqual({
      ok: false,
      error: { code: "unknown_error", message: "m" },
    });
    await expect(failingWith({ code: "c", message: long })).resolves.toStrictEqual({ ok: false, error: { code: "c" } });
    await expect(
      failingWith({ code: "c", message: "m", translation_domain: long, translation_key: long }),
    ).resolves.toStrictEqual({ ok: false, error: { code: "c" } });
  });

  it("gives unknown_error for an empty or non-string code", async () => {
    for (const code of ["", 3, { nested: true }]) {
      await expect(failingWith({ code })).resolves.toStrictEqual({ ok: false, error: { code: "unknown_error" } });
    }
  });

  it("reads only own properties, never inherited ones", async () => {
    const inherited = Object.create({ code: "home_assistant_error", message: "Unauthorized" });
    await expect(failingWith(inherited)).resolves.toStrictEqual({ ok: false, error: { code: "unknown_error" } });
  });
});
