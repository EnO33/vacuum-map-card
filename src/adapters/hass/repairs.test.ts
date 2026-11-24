import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeFrontendHass } from "../../../test/fakes/frontend-hass";
import repairs from "../../../test/fixtures/ha-core/synthetic/repairs_list_issues.json" with { type: "json" };
import { createEntityRegistry, type EntityRegistry } from "./entity-registry";
import { createRepairIssues, type RepairIssues, segmentsChangedReader } from "./repairs";

const ROBOT_ONE = "vacuum.robot_one";
const ROBOT_TWO = "vacuum.robot_two";

let hass: FakeFrontendHass;
let registry: EntityRegistry;
let issues: RepairIssues;
let open: (entityId: string) => boolean;

function issue(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    domain: "vacuum",
    issue_id: "segments_changed_03030303030303030303030303030303",
    ignored: false,
    translation_key: "segments_changed",
    ...overrides,
  };
}

/** Starts both lists, with the issues answered by `list`, and waits for the fetches. */
async function loaded(list: unknown = repairs): Promise<void> {
  const answer = hass.answerWS;
  hass.answerWS = (message) =>
    message.type === "repairs/list_issues" ? Promise.resolve(structuredClone(list)) : answer(message);
  registry.start();
  issues.start();
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  vi.useFakeTimers();
  hass = new FakeFrontendHass();
  registry = createEntityRegistry(() => hass);
  issues = createRepairIssues(() => hass);
  open = segmentsChangedReader(registry, issues);
});

afterEach(() => {
  registry.stop();
  issues.stop();
  vi.useRealTimers();
});

describe("createRepairIssues", () => {
  it("lists repairs/list_issues and follows repairs_issue_registry_updated", async () => {
    issues.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(hass.wsCalls).toStrictEqual([{ type: "repairs/list_issues" }]);
    expect(hass.connection.subscriptions.map((s) => s.eventType)).toStrictEqual(["repairs_issue_registry_updated"]);
  });

  it("keeps only the ids of vacuum segments_changed issues, ignored ones included", async () => {
    await loaded();
    expect([...(issues.value() ?? [])]).toStrictEqual([
      "segments_changed_03030303030303030303030303030303",
      "segments_changed_0f1e2d3c4b5a69788796a5b4c3d2e1f0",
    ]);
  });

  it("never reads translation_placeholders", async () => {
    const read: (string | symbol)[] = [];
    const watched = new Proxy(issue({}), {
      getOwnPropertyDescriptor(target, key) {
        read.push(key);
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    hass.answerWS = () => Promise.resolve({ issues: [watched] });
    issues.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(issues.value()?.size).toBe(1);
    expect(read).not.toContain("translation_placeholders");
  });

  it.each<[string, unknown]>([
    ["not an object", "issues"],
    ["an array", []],
    ["without an issues array", { issues: {} }],
    ["with an inherited issues array", Object.create({ issues: [] })],
  ])("treats a response %s as a failed fetch", async (_, response) => {
    hass.answerWS = () => Promise.resolve(response);
    issues.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(issues.value()).toBeUndefined();
  });

  it("skips entries that are not issues", async () => {
    await loaded({ issues: [null, "x", issue({ issue_id: 3 }), issue({ domain: null }), issue({})] });
    expect(issues.value()?.size).toBe(1);
  });

  it("keeps its identity on an equal re-fetch, and changes when an issue goes", async () => {
    const changes = vi.fn();
    issues.onChange(changes);
    await loaded();
    const first = issues.value();
    hass.connection.emit("repairs_issue_registry_updated");
    await vi.advanceTimersByTimeAsync(500);
    expect(issues.value()).toBe(first);
    hass.answerWS = () => Promise.resolve({ issues: [] });
    hass.connection.emit("repairs_issue_registry_updated");
    await vi.advanceTimersByTimeAsync(500);
    expect(issues.value()?.size).toBe(0);
    expect(changes).toHaveBeenCalledTimes(2);
  });
});

describe("segmentsChangedOpen", () => {
  it("is true until both lists are read", async () => {
    expect(open(ROBOT_ONE)).toBe(true);
    registry.start();
    await vi.advanceTimersByTimeAsync(0);
    hass.answerWS = () => new Promise(() => {});
    issues.start();
    expect(open(ROBOT_TWO)).toBe(true);
  });

  it("is true while the registry list is not read, even when the issues are", async () => {
    issues.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(issues.value()).toBeDefined();
    expect(open(ROBOT_TWO)).toBe(true);
  });

  it("reads the fixtures: open for robot_one, not for robot_two (other domain)", async () => {
    await loaded();
    expect(open(ROBOT_ONE)).toBe(true);
    expect(open(ROBOT_TWO)).toBe(false);
  });

  it("is true for a vacuum without a registry entry", async () => {
    await loaded({ issues: [] });
    expect(open("vacuum.robot_nine")).toBe(true);
  });

  it("is false when no issue matches", async () => {
    await loaded({ issues: [] });
    expect(open(ROBOT_ONE)).toBe(false);
  });

  it.each<[string, Record<string, unknown>]>([
    ["another domain", { domain: "roomba_plus" }],
    ["another id", { issue_id: "segments_changed_0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a" }],
    ["a longer id with the same prefix", { issue_id: "segments_changed_03030303030303030303030303030303_2" }],
    ["a shorter id", { issue_id: "segments_changed_0303" }],
  ])("does not count an issue with %s", async (_, overrides) => {
    await loaded({ issues: [issue(overrides)] });
    expect(open(ROBOT_ONE)).toBe(false);
  });

  it.each<[string, () => Promise<unknown>]>([
    ["rejected", () => Promise.reject(new Error("Connection lost"))],
    ["refused", () => Promise.resolve({ issues: "none" })],
  ])("is true after an update whose fetch is %s, until a fetch succeeds", async (_, failing) => {
    await loaded({ issues: [] });
    expect(open(ROBOT_ONE)).toBe(false);
    const answer = hass.answerWS;
    hass.answerWS = failing;
    hass.connection.emit("repairs_issue_registry_updated");
    await vi.advanceTimersByTimeAsync(500);
    expect(open(ROBOT_ONE)).toBe(true);
    hass.answerWS = answer;
    hass.connection.emit("repairs_issue_registry_updated");
    await vi.advanceTimersByTimeAsync(500);
    expect(open(ROBOT_ONE)).toBe(false);
  });

  it("counts an ignored issue: ignoring the repair does not update the mapping", async () => {
    await loaded({ issues: [issue({ ignored: true })] });
    expect(open(ROBOT_ONE)).toBe(true);
  });
});
