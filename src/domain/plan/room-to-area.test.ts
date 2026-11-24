import { describe, expect, expectTypeOf, it } from "vitest";
import areaRegistry from "../../../test/fixtures/ha-core/area_registry_list.json" with { type: "json" };
import floorRegistry from "../../../test/fixtures/ha-core/floor_registry_list.json" with { type: "json" };
import { areaMappingOf, knownAreaIds, mappingFixtures } from "../../../test/helpers/area-mapping";
import { areasOf, floorsOf } from "../../../test/helpers/registry";
import { snapshotFixtures, snapshotOf } from "../../../test/helpers/rooms-snapshot";
import { segmentIdIn } from "../../../test/helpers/stored-maps";
import { readAreaMapping } from "../mapping/area-mapping";
import type { Area } from "../registry/types";
import { unsupported } from "../unsupported";
import { type AreaLink, areaOfRoom, type CoreAreaLink, type RoomAreaContext } from "./room-to-area";

const floors = floorsOf(floorRegistry);
const areas = areasOf(areaRegistry);
const mapping = readAreaMapping(areaMappingOf(mappingFixtures.vacuum), knownAreaIds);

/** A plan on `ground_floor`, paired with MapA (so its rooms get `MapA_q1W2e3_<region id>`). */
const pairedOnGround: RoomAreaContext = {
  floors,
  areas,
  mapping,
  planFloorId: "ground_floor",
  segmentIdOf: (regionId) => segmentIdIn("MapA_q1W2e3", regionId),
};

/** The vacuum robot's rooms map as captured: unpaired (two stored maps), in « no floor » (see pairing.test.ts). */
const unpairedNoFloor: RoomAreaContext = { ...pairedOnGround, planFloorId: undefined, segmentIdOf: undefined };

const room = (regionId: string, name: string) => ({ regionId, name });

describe("areaOfRoom, rule 1: the core mapping", () => {
  it("links a paired room whose segment is under one area", () => {
    expect(areaOfRoom(room("1", "Reading room"), pairedOnGround)).toEqual({ kind: "core", areaId: "library" });
  });

  it("falls through to the name when the segment is under two areas", () => {
    const twoAreas = readAreaMapping(
      new Map([
        ["library", ["MapA_q1W2e3_1"]],
        ["workshop", ["MapA_q1W2e3_1"]],
      ]),
      knownAreaIds,
    );
    expect(areaOfRoom(room("1", "Library"), { ...pairedOnGround, mapping: twoAreas })).toEqual({
      kind: "name",
      areaId: "library",
    });
  });

  it("falls through to the name when the segment is under no area", () => {
    expect(areaOfRoom(room("7", "Workshop"), pairedOnGround)).toEqual({ kind: "name", areaId: "workshop" });
  });

  it("never links to an area that is no longer in the area list", () => {
    const withoutLibrary = new Map([...areas].filter(([areaId]) => areaId !== "library"));
    expect(areaOfRoom(room("1", "Reading room"), { ...pairedOnGround, areas: withoutLibrary })).toEqual({
      kind: "none",
    });
  });

  it.each([
    ["an unpaired plan", { segmentIdOf: undefined }],
    ["no segment id from the adapter", { segmentIdOf: () => undefined }],
    ["an absent mapping", { mapping: readAreaMapping(undefined, knownAreaIds) }],
    ["an unsupported mapping", { mapping: unsupported("too_many_keys") }],
  ])("is not used for %s", (_, change) => {
    expect(areaOfRoom(room("1", "Reading room"), { ...pairedOnGround, ...change })).toEqual({ kind: "none" });
  });
});

describe("areaOfRoom, rule 2: the room name", () => {
  const library = snapshotOf(snapshotFixtures.vacuumAligned).rooms.find((r) => r.regionId === "1");
  if (!library) throw new Error("the fixture has room 1");

  it("links the vacuum robot's « Library » by name on an unpaired plan placed on ground_floor, never by core", () => {
    expect(areaOfRoom(library, { ...unpairedNoFloor, planFloorId: "ground_floor" })).toEqual({
      kind: "name",
      areaId: "library",
    });
  });

  it("gives it no area as captured: the plan is in « no floor » and library has a floor", () => {
    expect(areaOfRoom(library, unpairedNoFloor)).toEqual({ kind: "none" });
  });

  it("compares names as the registries do, and matches an alias", () => {
    expect(areaOfRoom(room("9", "music ROOM"), { ...unpairedNoFloor, planFloorId: "upper_floor" })).toMatchObject({
      areaId: "music_room",
    });
    const aliased = new Map(areas);
    aliased.set("studio", { areaId: "studio", name: "Studio", aliases: ["Atelier"], floorId: "upper_floor" });
    expect(
      areaOfRoom(room("9", "Atelier"), { ...unpairedNoFloor, areas: aliased, planFloorId: "upper_floor" }),
    ).toEqual({ kind: "name", areaId: "studio" });
  });

  it("ignores an area on another floor than the plan", () => {
    expect(areaOfRoom(library, { ...unpairedNoFloor, planFloorId: "upper_floor" })).toEqual({ kind: "none" });
  });

  it("keeps an area on no floor for a plan on a floor", () => {
    expect(areaOfRoom(room("9", "Greenhouse"), { ...unpairedNoFloor, planFloorId: "ground_floor" })).toEqual({
      kind: "name",
      areaId: "greenhouse",
    });
  });

  it("keeps only areas on no floor for a plan in « no floor »", () => {
    expect(areaOfRoom(room("9", "Greenhouse"), unpairedNoFloor)).toEqual({ kind: "name", areaId: "greenhouse" });
  });

  it("treats an area whose floor is not listed as on no floor", () => {
    const orphan: Area = { areaId: "attic", name: "Attic", aliases: [], floorId: "gone_floor" };
    const withOrphan = new Map([...areas, ["attic", orphan]]);
    expect(areaOfRoom(room("9", "Attic"), { ...unpairedNoFloor, areas: withOrphan })).toEqual({
      kind: "name",
      areaId: "attic",
    });
  });

  it("counts only areas on the plan's floor or on no floor before asking for exactly one", () => {
    const office = (areaId: string, floorId: string | null, aliases: string[] = []): Area => ({
      areaId,
      name: areaId === "office" ? "Office" : "Study",
      aliases,
      floorId,
    });
    const offices = new Map([
      ...areas,
      ["office", office("office", "ground_floor")],
      ["study", office("study", "upper_floor", ["Office"])],
    ]);
    expect(
      areaOfRoom(room("9", "Office"), { ...unpairedNoFloor, areas: offices, planFloorId: "ground_floor" }),
    ).toEqual({
      kind: "name",
      areaId: "office",
    });
    expect(areaOfRoom(room("9", "Office"), { ...unpairedNoFloor, areas: offices })).toEqual({ kind: "none" });
  });

  it("gives no area when the name matches several areas", () => {
    const twin: Area = { areaId: "library_2", name: "Library", aliases: [], floorId: "ground_floor" };
    const twins = new Map([...areas, ["library_2", twin]]);
    expect(areaOfRoom(library, { ...unpairedNoFloor, areas: twins, planFloorId: "ground_floor" })).toEqual({
      kind: "none",
    });
  });
});

describe("AreaLink types", () => {
  it("lets only a core link stand where path 1 expects one", () => {
    expectTypeOf<Extract<AreaLink, { kind: "core" }>>().toEqualTypeOf<CoreAreaLink>();
    expectTypeOf<Extract<AreaLink, { kind: "name" }>>().not.toExtend<CoreAreaLink>();
    expectTypeOf<AreaLink>().not.toExtend<CoreAreaLink>();
  });
});
