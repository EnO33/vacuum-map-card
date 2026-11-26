import { describe, expect, it } from "vitest";
import { type CardConfig, parseConfig } from "./card-config";

const NONE: CardConfig = { title: undefined, robots: undefined, floors: undefined };
const LONG = "x".repeat(256);

describe("parseConfig", () => {
  it.each([
    ["an empty config", {}],
    ["the type alone", { type: "custom:vacuum-map-card" }],
    ["options left empty in YAML", { title: null, robots: null, floors: null }],
    ["empty lists", { robots: [], floors: [] }],
    ["a blank title", { title: "  " }],
  ])("reads %s as no option", (_case, raw) => {
    expect(parseConfig(raw)).toStrictEqual(NONE);
  });

  it("returns a frozen config with frozen lists", () => {
    const config = parseConfig({ title: "Robots", robots: ["vacuum.a"], floors: ["ground"] });
    expect(config).toStrictEqual({ title: "Robots", robots: ["vacuum.a"], floors: ["ground"] });
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.robots)).toBe(true);
    expect(Object.isFrozen(config.floors)).toBe(true);
  });

  it("copies the lists, so a later change of the raw config changes nothing", () => {
    const robots = ["vacuum.a"];
    const config = parseConfig({ robots });
    robots.push("vacuum.b");
    expect(config.robots).toStrictEqual(["vacuum.a"]);
  });

  it.each([
    ["a title", { title: "Upstairs" }, { title: "Upstairs" }],
    ["a title of 255 characters", { title: "t".repeat(255) }, { title: "t".repeat(255) }],
    ["robots", { robots: ["vacuum.robot_one", "vacuum.robot_2"] }, { robots: ["vacuum.robot_one", "vacuum.robot_2"] }],
    ["floors", { floors: ["upper_floor", "ground_floor"] }, { floors: ["upper_floor", "ground_floor"] }],
  ])("reads %s", (_case, raw, expected) => {
    expect(parseConfig(raw)).toStrictEqual({ ...NONE, ...expected });
  });

  it.each([
    ["type", "custom:vacuum-map-card"],
    ["grid_options", { columns: 6 }],
    ["layout_options", { grid_columns: 4 }],
    ["visibility", [{ condition: "screen" }]],
    ["view_layout", { position: "main" }],
    ["index", 0],
    ["view_index", 1],
    ["disabled", false],
  ])("leaves Home Assistant's own key %s to Home Assistant", (key, value) => {
    expect(parseConfig({ [key]: value })).toStrictEqual(NONE);
  });

  it("leaves card-mod's key to card-mod, which users add to every card", () => {
    expect(parseConfig({ card_mod: { style: "ha-card { border: none; }" } })).toStrictEqual(NONE);
  });

  it.each([
    ["null", null],
    ["a string", "custom:vacuum-map-card"],
    ["a list", []],
  ])("rejects %s as a whole config", (_case, raw) => {
    expect(() => parseConfig(raw)).toThrow(
      "The card's configuration must be options, such as title: Cleaning, not a list or a single value.",
    );
  });

  it("rejects an unknown key and names it", () => {
    expect(() => parseConfig({ robot: ["vacuum.a"] })).toThrow(
      'Unknown option "robot". The options are title, robots and floors.',
    );
  });

  it("rejects an unknown key too long to repeat without naming it", () => {
    expect(() => parseConfig({ [LONG]: 1 })).toThrow(
      "Unknown option (its name is longer than 255 characters). The options are title, robots and floors.",
    );
  });

  it.each([
    ["a number", 3],
    ["a list", ["Robots"]],
    ["a string over 255 characters", "t".repeat(256)],
  ])("rejects a title that is %s", (_case, title) => {
    expect(() => parseConfig({ title })).toThrow('Option "title" must be text of at most 255 characters.');
  });

  it.each([
    ["robots", 'Option "robots" must be a list, one vacuum entity id per line, for example "- vacuum.my_robot".'],
    ["floors", 'Option "floors" must be a list, one floor id per line, for example "- ground_floor".'],
  ])("rejects %s that is not a list, showing the list form", (key, message) => {
    expect(() => parseConfig({ [key]: "vacuum.a" })).toThrow(message);
  });

  it.each([
    ["light.lamp", '"light.lamp"'],
    ["vacuum.", '"vacuum."'],
    ["vacuum._robot", '"vacuum._robot"'],
    ["vacuum.robot_", '"vacuum.robot_"'],
    ["vacuum.Robot", '"vacuum.Robot"'],
    ["vacuum.robot one", '"vacuum.robot one"'],
    ["vacuum.robot__one", '"vacuum.robot__one"'],
  ])("rejects the robot %s, which is not a vacuum entity id", (entry, quoted) => {
    expect(() => parseConfig({ robots: [entry] })).toThrow(
      `Option "robots": ${quoted} is not a vacuum entity id (for example vacuum.my_robot).`,
    );
  });

  it.each([
    ["a number", 3, "3"],
    ["null", null, "null"],
    ["an object", { entity: "vacuum.a" }, "an object"],
  ])("rejects a robot entry that is %s", (_case, entry, shown) => {
    expect(() => parseConfig({ robots: [entry] })).toThrow(
      `Option "robots": ${shown} is not a vacuum entity id (for example vacuum.my_robot).`,
    );
  });

  it("rejects a robot id over 255 characters without repeating it", () => {
    const id = `vacuum.${"r".repeat(249)}`;
    expect(() => parseConfig({ robots: [id] })).toThrow(
      'Option "robots": an entry is longer than 255 characters, so it is not a vacuum entity id.',
    );
  });

  it.each([
    ["an empty string", "", '""'],
    ["a number", 2, "2"],
    ["a list", ["ground"], "a list"],
  ])("rejects a floor entry that is %s", (_case, entry, shown) => {
    expect(() => parseConfig({ floors: [entry] })).toThrow(`Option "floors": ${shown} is not a floor id.`);
  });

  it("rejects a floor id over 255 characters without repeating it", () => {
    expect(() => parseConfig({ floors: [LONG] })).toThrow(
      'Option "floors": an entry is longer than 255 characters, so it is not a floor id.',
    );
  });

  it("rejects a hole in a list", () => {
    // biome-ignore lint/suspicious/noSparseArray: the hole is the case under test.
    expect(() => parseConfig({ floors: ["ground", , "upper"] })).toThrow(
      'Option "floors": undefined is not a floor id.',
    );
  });

  it.each([
    ["robots", ["vacuum.a", "vacuum.b", "vacuum.a"], '"vacuum.a"'],
    ["floors", ["ground", "ground"], '"ground"'],
  ])("rejects %s listed twice", (key, list, quoted) => {
    expect(() => parseConfig({ [key]: list })).toThrow(`Option "${key}" lists ${quoted} more than once.`);
  });

  it("never runs a getter of the raw config, and reads it as not set", () => {
    const raw = {};
    let ran = false;
    Object.defineProperty(raw, "title", {
      enumerable: true,
      get() {
        ran = true;
        return "Robots";
      },
    });
    expect(parseConfig(raw)).toStrictEqual(NONE);
    expect(ran).toBe(false);
  });
});
