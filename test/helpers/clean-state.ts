// Test helpers for the clean controller: a port over swappable state, and fixture state changed one value at a time.
import type { HassPort } from "../../src/app/ports/hass-port";
import type { RoomSource } from "../../src/app/ports/room-source";
import { FakeHass, type FakeHassSettings } from "../fakes/fake-hass";
import { FakeRoomSource } from "../fakes/fake-room-source";
import { withRobot } from "./sources";

const settings: FakeHassSettings = { services: ["vacuum.clean_area"] };

/** A `HassPort` that always delegates to the current fake, so a test can swap the state between prepare and confirm. */
export function portOf(current: () => FakeHass) {
  return {
    floors: () => current().floors(),
    areas: () => current().areas(),
    vacuum: (id: string) => current().vacuum(id),
    hasService: (domain: string, service: string) => current().hasService(domain, service),
    vacuumOptions: (id: string) => current().vacuumOptions(id),
    segmentsChangedOpen: (id: string) => current().segmentsChangedOpen(id),
    isAdmin: () => current().isAdmin(),
    callService: (call: Parameters<FakeHass["callService"]>[0]) => current().callService(call),
    subscribe: (listener: () => void) => current().subscribe(listener),
  };
}

export function withVacuum(state: string | undefined): FakeHass {
  const hass = new FakeHass(settings);
  const fixture = hass.vacuum.bind(hass);
  hass.vacuum = (id) => {
    const real = fixture(id);
    if (id !== "vacuum.robot_one") return real;
    return state === undefined || real === undefined ? undefined : { ...real, state };
  };
  return hass;
}

export function withMapping(entries: [string, string[]][]): FakeHass {
  const base = new FakeHass(settings);
  const options = base.vacuumOptions("vacuum.robot_one");
  if (options.kind !== "options") throw new Error("the fixture has options");
  return new FakeHass({
    ...settings,
    vacuumOptions: new Map([
      ["vacuum.robot_one", { ...options, areaMapping: { kind: "list", list: new Map(entries) } }],
    ]),
  });
}

export function withLastSeen(libraryName: string): FakeHass {
  const base = new FakeHass(settings);
  const options = base.vacuumOptions("vacuum.robot_one");
  if (options.kind !== "options" || options.lastSeenSegments.kind !== "list") throw new Error("the fixture has names");
  const list = options.lastSeenSegments.list.map((s) => (s.id === "MapA_q1W2e3_1" ? { ...s, name: libraryName } : s));
  return new FakeHass({
    ...settings,
    vacuumOptions: new Map([["vacuum.robot_one", { ...options, lastSeenSegments: { kind: "list", list } }]]),
  });
}

export function roomsMapWith(
  change: (snapshot: { state: string; rooms: readonly { regionId: string; name: string; roomId: string }[] }) => object,
): RoomSource[] {
  return [
    withRobot(new FakeRoomSource(), "vacuum.robot_one", (robot) => {
      const roomsMap = robot.roomsMap;
      if (roomsMap?.content.kind !== "snapshot") throw new Error("expected a snapshot");
      const snapshot = { ...roomsMap.content.snapshot, ...change(roomsMap.content.snapshot) };
      return { roomsMap: { ...roomsMap, content: { kind: "snapshot", snapshot } } };
    }),
  ];
}

/** A hass whose vacuum states are replaced for the given ids (`undefined`: no state), the rest as the fixtures. */
export function withStates(states: ReadonlyMap<string, { state: string } | undefined>): HassPort {
  const patched = new FakeHass(settings);
  const fixture = patched.vacuum.bind(patched);
  patched.vacuum = (entityId) => {
    if (!states.has(entityId)) return fixture(entityId);
    const state = states.get(entityId);
    return state && { state: state.state, supportedFeatures: fixture(entityId)?.supportedFeatures ?? 0 };
  };
  return patched;
}
