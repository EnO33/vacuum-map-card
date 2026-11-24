import { describe, expect, it } from "vitest";
import { snapshotFixtures, snapshotOf } from "../../../test/helpers/rooms-snapshot";
import type { Point } from "../geometry/types";
import { type RoomsMapSnapshot, type SnapshotRoom, sameRoomsSnapshot } from "./rooms-map-snapshot";

const base = (): RoomsMapSnapshot => snapshotOf(snapshotFixtures.threeRooms);

function withRoom(snapshot: RoomsMapSnapshot, index: number, change: Partial<SnapshotRoom>): RoomsMapSnapshot {
  return { ...snapshot, rooms: snapshot.rooms.map((room, i) => (i === index ? { ...room, ...change } : room)) };
}

function outlineOf(snapshot: RoomsMapSnapshot, index: number): readonly Point[] {
  const outline = snapshot.rooms[index]?.outline;
  if (!outline) throw new Error(`room ${index} has no outline`);
  return outline;
}

describe("sameRoomsSnapshot", () => {
  it.each(Object.entries(snapshotFixtures))("is true for two captures of the %s fixture", (_, fixture) => {
    const a = snapshotOf(fixture);
    const b = snapshotOf(fixture);
    expect(a).not.toBe(b);
    expect(sameRoomsSnapshot(a, b)).toBe(true);
  });

  it("treats a non-finite value as equal to itself, so a refused snapshot is not rebuilt on every update", () => {
    const snapshot = withRoom(base(), 0, { outline: [{ x: Number.NaN, y: 0 }] });
    expect(sameRoomsSnapshot(snapshot, structuredClone(snapshot))).toBe(true);
  });

  const changes: [string, (s: RoomsMapSnapshot) => RoomsMapSnapshot][] = [
    ["the picture state", (s) => ({ ...s, state: "2026-01-01T10:00:00+00:00" })],
    [
      "one calibration value",
      (s) => ({ ...s, calibration: s.calibration.map((p, i) => (i === 2 ? { ...p, map: { ...p.map, y: 153 } } : p)) }),
    ],
    [
      "one calibration vacuum value",
      (s) => ({
        ...s,
        calibration: s.calibration.map((p, i) => (i === 1 ? { ...p, vacuum: { ...p.vacuum, x: 6001 } } : p)),
      }),
    ],
    ["the number of calibration pairs", (s) => ({ ...s, calibration: s.calibration.slice(1) })],
    ["one room's name", (s) => withRoom(s, 1, { name: "Atelier" })],
    ["one room's region id", (s) => withRoom(s, 1, { regionId: "9" })],
    ["one room's room id", (s) => withRoom(s, 1, { roomId: "atelier" })],
    ["one room's icon", (s) => withRoom(s, 1, { icon: "mdi:sofa" })],
    ["a room's icon disappearing", (s) => ({ ...s, rooms: s.rooms.map(({ icon: _, ...r }) => r) })],
    [
      "one outline point",
      (s) => withRoom(s, 2, { outline: outlineOf(s, 2).map((p, i) => (i === 3 ? { ...p, x: p.x + 1 } : p)) }),
    ],
    ["one outline disappearing", (s) => ({ ...s, rooms: s.rooms.map(({ outline: _, ...r }) => r) })],
    ["the number of outline points", (s) => withRoom(s, 0, { outline: outlineOf(s, 0).slice(1) })],
    ["the number of rooms", (s) => ({ ...s, rooms: s.rooms.slice(1) })],
  ];

  it.each(changes)("is false when %s changes", (_, change) => {
    const a = base();
    const b = change(base());
    expect(sameRoomsSnapshot(a, b)).toBe(false);
    expect(sameRoomsSnapshot(b, a)).toBe(false);
  });
});
