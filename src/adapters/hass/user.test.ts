import { beforeEach, describe, expect, it } from "vitest";
import { FakeFrontendHass } from "../../../test/fakes/frontend-hass";
import { adminReader } from "./user";

let hass: FakeFrontendHass;

beforeEach(() => {
  hass = new FakeFrontendHass();
});

describe("adminReader", () => {
  const isAdmin = adminReader(() => hass);

  it("is true only for is_admin true", () => {
    hass.user = { is_admin: true };
    expect(isAdmin()).toBe(true);
  });

  it.each<[string, unknown]>([
    ["a non-admin", { is_admin: false }],
    ["a truthy string", { is_admin: "true" }],
    ["a missing flag", {}],
    ["a missing user", undefined],
    ["a null user", null],
    ["an inherited flag", Object.create({ is_admin: true })],
  ])("is false for %s", (_, user) => {
    hass.user = user;
    expect(isAdmin()).toBe(false);
  });

  it("reads hass again on each call", () => {
    expect(isAdmin()).toBe(false);
    const other = new FakeFrontendHass();
    other.user = { is_admin: true };
    hass = other;
    expect(isAdmin()).toBe(true);
  });
});
