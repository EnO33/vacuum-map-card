// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAdapters } from "../src/adapters/create-adapters";
import { isFrontendHass } from "../src/adapters/hass/frontend-hass";
import { createFloorModelBuilder } from "../src/app/floor-model/memo";
import { DemoHass, isOutcome, OUTCOMES } from "./demo-hass";
import { PLAN_PICTURES } from "./plans";

/** Every picture a room source reports, floor plans and rooms maps, with its state. */
async function reportedPictures(hass: DemoHass) {
  const adapters = createAdapters(() => hass);
  adapters.start();
  await vi.advanceTimersByTimeAsync(0);
  const pictures = adapters
    .sources()
    .flatMap((source) => source.robots())
    .flatMap((robot) => [
      ...robot.storedMaps.map((map) => ({ entityId: map.floorPlanEntityId, state: map.pictureState })),
      ...(robot.roomsMap === undefined
        ? []
        : [{ entityId: robot.roomsMap.imageEntityId, state: robot.roomsMap.pictureState }]),
    ])
    .map((picture) => ({ ...picture, url: adapters.pictureUrl(picture.entityId) }));
  adapters.stop();
  return pictures;
}

/** Each robot's plans: picture, picture state, floor (or `none`) and content kind. */
async function planLayout(hass: DemoHass) {
  const adapters = createAdapters(() => hass);
  adapters.start();
  await vi.advanceTimersByTimeAsync(0);
  const model = createFloorModelBuilder()(adapters.hass, adapters.sources());
  adapters.stop();
  return model.robots.map((robot) => ({
    robot: robot.vacuumEntityId,
    plans: robot.plans.map((plan) => ({
      picture: plan.imageEntityId,
      state: plan.pictureState,
      floor: plan.placement.kind === "floor" ? plan.placement.floorId : "none",
      content: plan.content.kind,
    })),
  }));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DemoHass", () => {
  it("passes the card's boundary check", () => {
    expect(isFrontendHass(new DemoHass())).toBe(true);
  });

  it("shows the vacuum with outlines on one floor, the mop picture only on another, and one disabled plan", async () => {
    expect(await planLayout(new DemoHass())).toStrictEqual([
      {
        robot: "vacuum.robot_one",
        plans: [
          { picture: "image.robot_one_rooms_map", state: "available", floor: "ground_floor", content: "outlines" },
        ],
      },
      {
        robot: "vacuum.robot_two",
        plans: [
          { picture: "image.robot_two_rooms_map", state: "available", floor: "none", content: "outlines" },
          {
            picture: "image.robot_two_floor_plan_mapc_k4l5m6",
            state: "disabled",
            floor: "none",
            content: "picture_only",
          },
          {
            picture: "image.robot_two_floor_plan_mapd_r7t8y9",
            state: "available",
            floor: "upper_floor",
            content: "picture_only",
          },
        ],
      },
    ]);
  });

  it("serves every enabled plan picture from an invented file under demo/plans, on the page's own origin", async () => {
    const pictures = (await reportedPictures(new DemoHass())).filter((picture) => picture.state !== "disabled");
    expect(pictures.map((picture) => picture.entityId).sort()).toStrictEqual([...PLAN_PICTURES.keys()].sort());
    for (const { entityId, url } of pictures) {
      expect(url).toBe(PLAN_PICTURES.get(entityId));
      // A path on the dev server, or the file inlined by Vite: never another origin.
      expect(url).toMatch(/^(\/[^/]|data:image\/svg\+xml[;,])/);
    }
  });

  it("has exactly one disabled floor plan, with no picture and no state", async () => {
    const hass = new DemoHass();
    const disabled = (await reportedPictures(hass)).filter((picture) => picture.state === "disabled");
    expect(disabled).toHaveLength(1);
    expect(disabled[0]?.url).toBeUndefined();
    expect(Object.keys(Object(hass.states))).not.toContain(disabled[0]?.entityId);
  });

  it("keeps any other path on the page's own origin", () => {
    expect(new DemoHass().hassUrl("/api/other")).toBe("/api/other");
    expect(new DemoHass().hassUrl()).toBe("/");
  });

  it("accepts a clean by default and records the call", async () => {
    const hass = new DemoHass();
    await expect(hass.callService("vacuum", "clean_area", { cleaning_area_id: ["library"] })).resolves.toBeDefined();
    expect(hass.calls).toHaveLength(1);
  });

  it("refuses a clean with a Home Assistant validation error", async () => {
    const hass = new DemoHass();
    hass.outcome = "refused";
    await expect(hass.callService("vacuum", "clean_area")).rejects.toMatchObject({
      code: "service_validation_error",
      translation_key: "area_mapping_not_configured",
    });
  });

  it("never answers when asked to", async () => {
    const hass = new DemoHass();
    hass.outcome = "never";
    const settled = vi.fn();
    hass.callService("vacuum", "clean_area").then(settled, settled);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(settled).not.toHaveBeenCalled();
    expect(hass.calls).toHaveLength(1);
  });

  it.each(OUTCOMES)("tells the page about each call when the answer is %s", (outcome) => {
    const hass = new DemoHass();
    hass.outcome = outcome;
    const seen = vi.fn();
    hass.onCall = seen;
    hass
      .callService("vacuum", "clean_area", { cleaning_area_id: ["library"] }, { entity_id: "vacuum.robot_one" })
      .catch(() => undefined);
    expect(seen).toHaveBeenCalledWith([
      "vacuum",
      "clean_area",
      { cleaning_area_id: ["library"] },
      { entity_id: "vacuum.robot_one" },
    ]);
  });

  it.each(OUTCOMES)("knows the outcome %s", (outcome) => {
    expect(isOutcome(outcome)).toBe(true);
  });

  it("rejects an unknown outcome", () => {
    expect(isOutcome("maybe")).toBe(false);
  });
});
