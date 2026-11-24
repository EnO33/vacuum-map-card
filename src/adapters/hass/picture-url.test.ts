import { beforeEach, describe, expect, it } from "vitest";
import { FakeRoomSource } from "../../../test/fakes/fake-room-source";
import { FakeFrontendHass } from "../../../test/fakes/frontend-hass";
import floorPlan from "../../../test/fixtures/ha-core/hass_state_image_floor_plan.json" with { type: "json" };
import roomsMapOne from "../../../test/fixtures/roomba-plus/hass_state_rooms_map_vacuum_aligned.json" with {
  type: "json",
};
import { expectNoConsoleOutput } from "../../../test/helpers/no-console";
import { MAX_TEXT_LENGTH } from "../../domain/text/limits";
import { pictureUrl } from "./picture-url";

const BASE = "https://ha.example.invalid";
const PLAN = "image.robot_one_floor_plan_mapa_q1w2e3";
const ROOMS = "image.robot_one_rooms_map";
const TOKEN = "0000000000000000000000000000000000000000000000000000000000000001";

let hass: FakeFrontendHass;
const sources = [new FakeRoomSource()];
const urlOf = (entityId: string) => pictureUrl(() => hass, sources, entityId);

function withState(entityId: string, state: unknown): void {
  hass.states = { [entityId]: state };
}

expectNoConsoleOutput();

beforeEach(() => {
  hass = new FakeFrontendHass();
  hass.states = { [PLAN]: structuredClone(floorPlan), [ROOMS]: structuredClone(roomsMapOne) };
});

describe("pictureUrl", () => {
  it("builds the frontend's image proxy URL for a floor plan and a rooms map", () => {
    expect(urlOf(PLAN)).toBe(
      `${BASE}/api/image_proxy/${PLAN}?token=${TOKEN}&state=${encodeURIComponent(floorPlan.state)}`,
    );
    expect(urlOf(ROOMS)).toBe(
      `${BASE}/api/image_proxy/${ROOMS}?token=${TOKEN}&state=${encodeURIComponent(roomsMapOne.state)}`,
    );
  });

  it("never reads entity_picture", () => {
    withState(PLAN, { state: "1", attributes: { access_token: "t", entity_picture: "https://elsewhere.invalid/x" } });
    expect(urlOf(PLAN)).toBe(`${BASE}/api/image_proxy/${PLAN}?token=t&state=1`);
    withState(PLAN, { state: "1", attributes: { entity_picture: `/api/image_proxy/${PLAN}?token=t` } });
    expect(urlOf(PLAN)).toBeUndefined();
  });

  it("gives nothing for an image entity no room source reports, even with a token", () => {
    withState("image.doorbell_snapshot", { state: "1", attributes: { access_token: "t" } });
    expect(urlOf("image.doorbell_snapshot")).toBeUndefined();
  });

  it("gives nothing for a disabled floor plan the source reports", () => {
    const disabled = [new FakeRoomSource({ disabledFloorPlans: true })];
    const entityId = "image.robot_one_floor_plan_mapb_z9x8c7";
    withState(entityId, { state: "1", attributes: { access_token: "t" } });
    expect(pictureUrl(() => hass, disabled, entityId)).toBeUndefined();
  });

  it("encodes the token, the state and the entity id, under the fixed path", () => {
    withState(PLAN, { state: "a&b#c?d/e+f", attributes: { access_token: "t&k#n?/+=" } });
    expect(urlOf(PLAN)).toBe(`${BASE}/api/image_proxy/${PLAN}?token=t%26k%23n%3F%2F%2B%3D&state=a%26b%23c%3Fd%2Fe%2Bf`);
  });

  it("keeps no cache: a rotated token gives the new URL", () => {
    const first = urlOf(PLAN);
    withState(PLAN, { ...structuredClone(floorPlan), attributes: { access_token: "rotated" } });
    expect(urlOf(PLAN)).not.toBe(first);
    expect(urlOf(PLAN)).toContain("token=rotated");
  });

  it.each<[string, unknown]>([
    ["no state", undefined],
    ["an unavailable state", { state: "unavailable", attributes: { access_token: "t" } }],
    ["an unknown state", { state: "unknown", attributes: { access_token: "t" } }],
    ["a non-string state", { state: 3, attributes: { access_token: "t" } }],
    ["no attributes", { state: "1" }],
    ["an empty token", { state: "1", attributes: { access_token: "" } }],
    ["a non-string token", { state: "1", attributes: { access_token: 1 } }],
    ["an over-cap token", { state: "1", attributes: { access_token: "t".repeat(MAX_TEXT_LENGTH + 1) } }],
    ["an inherited token", { state: "1", attributes: Object.create({ access_token: "t" }) }],
  ])("gives nothing with %s", (_, state) => {
    hass.states = state === undefined ? {} : { [PLAN]: state };
    expect(urlOf(PLAN)).toBeUndefined();
  });

  it("gives nothing when hass.states is not an object", () => {
    hass.states = null;
    expect(urlOf(PLAN)).toBeUndefined();
  });

  it("reads only own keys of hass.states", () => {
    hass.states = Object.create({ [PLAN]: structuredClone(floorPlan) });
    expect(urlOf(PLAN)).toBeUndefined();
  });

  it("never throws, and puts no token in an error", () => {
    hass.hassUrl = (path) => {
      throw new Error(`cannot resolve ${path}`);
    };
    expect(urlOf(PLAN)).toBeUndefined();
    const throwing = [
      {
        integration: "broken",
        robots: () => {
          throw new Error("boom");
        },
      },
    ];
    expect(pictureUrl(() => hass, throwing, PLAN)).toBeUndefined();
  });
});
