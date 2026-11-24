import { describe, expect, it } from "vitest";
import { FakeFrontendHass } from "../../../test/fakes/frontend-hass";
import { isFrontendHass } from "./frontend-hass";

const noop = () => undefined;

function connection(): Record<string, unknown> {
  return { subscribeEvents: noop, addEventListener: noop, removeEventListener: noop };
}

/** The smallest plain object that passes, as the frontend builds `hass`: own function properties. */
function plainHass(): Record<string, unknown> {
  return {
    callWS: noop,
    callService: noop,
    hassUrl: noop,
    connection: connection(),
    states: null,
    language: null,
  };
}

describe("isFrontendHass", () => {
  it("accepts a plain object with the functions the adapters call, its other fields still null", () => {
    expect(isFrontendHass(plainHass())).toBe(true);
  });

  it("accepts the methods from the prototype, as a class instance has them", () => {
    expect(isFrontendHass(new FakeFrontendHass())).toBe(true);
  });

  it.each([[undefined], [null], ["hass"], [42], [() => undefined], [[]]])("refuses %j", (value) => {
    expect(isFrontendHass(value)).toBe(false);
  });

  it.each(["callWS", "callService", "hassUrl"])("refuses an object whose %s is not a function", (member) => {
    expect(isFrontendHass({ ...plainHass(), [member]: "not a function" })).toBe(false);
    const { [member]: _dropped, ...without } = plainHass();
    expect(isFrontendHass(without)).toBe(false);
  });

  it("refuses, without throwing, an object whose getter throws", () => {
    const hostile = {
      ...plainHass(),
      get connection(): never {
        throw new Error("getter");
      },
    };
    expect(isFrontendHass(hostile)).toBe(false);
    expect(
      isFrontendHass(
        new Proxy(
          {},
          {
            get: () => {
              throw new Error("trap");
            },
          },
        ),
      ),
    ).toBe(false);
  });

  it.each([[undefined], [null], ["connection"]])("refuses a connection of %j", (connection) => {
    expect(isFrontendHass({ ...plainHass(), connection })).toBe(false);
  });

  it.each(["subscribeEvents", "addEventListener", "removeEventListener"])(
    "refuses a connection whose %s is not a function",
    (member) => {
      expect(isFrontendHass({ ...plainHass(), connection: { ...connection(), [member]: 1 } })).toBe(false);
    },
  );
});
