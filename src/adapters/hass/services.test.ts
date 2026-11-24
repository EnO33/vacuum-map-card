import { beforeEach, describe, expect, it } from "vitest";
import { FakeFrontendHass } from "../../../test/fakes/frontend-hass";
import { serviceReader } from "./services";
import { adminReader } from "./user";

let hass: FakeFrontendHass;

beforeEach(() => {
  hass = new FakeFrontendHass();
});

describe("serviceReader", () => {
  const hasService = serviceReader(() => hass);

  it("finds a service by own keys at both levels", () => {
    hass.services = { vacuum: { clean_area: {} } };
    expect(hasService("vacuum", "clean_area")).toBe(true);
    expect(hasService("vacuum", "start")).toBe(false);
    expect(hasService("roomba_plus", "clean_room")).toBe(false);
  });

  it("reads no inherited key and treats __proto__ as an ordinary key", () => {
    hass.services = Object.create({ vacuum: { clean_area: {} } });
    expect(hasService("vacuum", "clean_area")).toBe(false);
    hass.services = { vacuum: Object.create({ clean_area: {} }) };
    expect(hasService("vacuum", "clean_area")).toBe(false);
    expect(hasService("vacuum", "toString")).toBe(false);
    expect(hasService("__proto__", "x")).toBe(false);
  });

  it.each<[string, unknown]>([
    ["missing", undefined],
    ["null", null],
    ["a domain that is not an object", { vacuum: "clean_area" }],
    ["a domain that is null", { vacuum: null }],
  ])("is false when hass.services is %s", (_, services) => {
    hass.services = services;
    expect(hasService("vacuum", "clean_area")).toBe(false);
  });

  it("reads hass again on each call", () => {
    hass.services = {};
    expect(hasService("vacuum", "clean_area")).toBe(false);
    const other = new FakeFrontendHass();
    other.services = { vacuum: { clean_area: {} } };
    hass = other;
    expect(hasService("vacuum", "clean_area")).toBe(true);
  });
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
