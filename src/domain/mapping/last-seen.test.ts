import { describe, expect, it } from "vitest";
import { lastSeenOf, mappingFixtures } from "../../../test/helpers/area-mapping";
import { MAX_TEXT_LENGTH } from "../text/limits";
import { unsupported } from "../unsupported";
import { type LastSeen, lastSeenName, readLastSeen } from "./last-seen";
import { MAX_LAST_SEEN_SEGMENTS } from "./limits";

const entries = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `seg_${i}`, name: `Room ${i}` }));
const long = "x".repeat(MAX_TEXT_LENGTH + 1);

function namesOf(lastSeen: LastSeen): ReadonlyMap<string, string> {
  if (lastSeen.kind !== "names") throw new Error(`expected names, got ${JSON.stringify(lastSeen)}`);
  return lastSeen.names;
}

describe("readLastSeen", () => {
  it("keeps the fixture's names exactly as stored", () => {
    const lastSeen = readLastSeen(lastSeenOf(mappingFixtures.vacuum));
    expect(namesOf(lastSeen).size).toBe(7);
    expect(lastSeenName(lastSeen, "MapA_q1W2e3_zid_0")).toBe("Reading table ");
    expect(lastSeenName(lastSeen, "MapB_z9X8c7_1")).toBe("Gallery");
    expect(lastSeenName(lastSeen, "MapZ_unknown_1")).toBeUndefined();
  });

  it.each([
    ["mop robot", mappingFixtures.mop],
    ["no-mapping", mappingFixtures.noMapping],
  ])("is absent for the %s fixture", (_, fixture) => {
    expect(readLastSeen(lastSeenOf(fixture))).toEqual({ kind: "absent" });
  });

  it("keeps an empty name", () => {
    expect(lastSeenName(readLastSeen([{ id: "a", name: "" }]), "a")).toBe("");
  });

  it("accepts the largest list and refuses one entry more", () => {
    expect(readLastSeen(entries(MAX_LAST_SEEN_SEGMENTS)).kind).toBe("names");
    expect(readLastSeen(entries(MAX_LAST_SEEN_SEGMENTS + 1))).toEqual(unsupported("too_many_entries"));
  });

  it("refuses a duplicate segment id, and then gives no name", () => {
    const lastSeen = readLastSeen([...entries(3), { id: "seg_1", name: "Again" }]);
    expect(lastSeen).toEqual(unsupported("duplicate_segment_id"));
    expect(lastSeenName(lastSeen, "seg_0")).toBeUndefined();
  });

  it.each([
    ["an id", { id: long, name: "Room" }],
    ["a name", { id: "a", name: long }],
  ])("refuses %s over the cap", (_, entry) => {
    expect(readLastSeen([...entries(2), entry])).toEqual(unsupported("text_too_long"));
  });

  it("treats object property names as ordinary ids", () => {
    const ids = ["__proto__", "constructor", "hasOwnProperty"];
    const lastSeen = readLastSeen(ids.map((id) => ({ id, name: `Name of ${id}` })));
    for (const id of ids) expect(lastSeenName(lastSeen, id)).toBe(`Name of ${id}`);
    expect(lastSeenName(lastSeen, "toString")).toBeUndefined();
  });
});
