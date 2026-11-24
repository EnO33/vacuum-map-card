import type { Schedule } from "./debounce";
import type { EntityRegistry } from "./entity-registry";
import type { FrontendHass } from "./frontend-hass";
import { isObject, ownValue } from "./own-property";
import { createWsCollection, type WsCollection } from "./ws-collection";

const SEGMENTS_CHANGED = "segments_changed_";

/** The ids of core's open `segments_changed` repair issues (domain `vacuum`), kept current. */
export type RepairIssues = WsCollection<ReadonlySet<string>>;

/**
 * `repairs/list_issues`, re-fetched on `repairs_issue_registry_updated`; both are open to non-admin users
 * (`docs/research/ha-core-vacuum.md` « When the integration reports different segments »). Only the ids of `vacuum`
 * issues starting with `segments_changed_` are kept, ignored issues included; `translation_placeholders` is never read.
 */
export function createRepairIssues(getHass: () => FrontendHass, schedule?: Schedule): RepairIssues {
  return createWsCollection({
    getHass,
    command: "repairs/list_issues",
    event: "repairs_issue_registry_updated",
    parse: parseIssueIds,
    equal: (a, b) => a.size === b.size && [...a].every((id) => b.has(id)),
    schedule,
  });
}

/** The ids of the response's `{issues: [...]}`, or `undefined` (a failed fetch) for any other shape. */
function parseIssueIds(raw: unknown): ReadonlySet<string> | undefined {
  const list = isObject(raw) ? ownValue(raw, "issues") : undefined;
  if (!Array.isArray(list)) return undefined;
  const ids = new Set<string>();
  for (const item of list) {
    if (!isObject(item) || ownValue(item, "domain") !== "vacuum") continue;
    const id = ownValue(item, "issue_id");
    if (typeof id === "string" && id.startsWith(SEGMENTS_CHANGED)) ids.add(id);
  }
  return ids;
}

/**
 * `HassPort.segmentsChangedOpen()`: whether the issue `segments_changed_<registry entry id>` is listed, compared as a
 * whole string. `true` until both lists are read, while the issue list is not settled (an update came and no fetch
 * after it succeeded yet), and for a vacuum without a registry entry: the safe side of ADR 0003 path 1 condition 6.
 * An ignored issue counts, since ignoring the repair does not update the mapping.
 */
export function segmentsChangedReader(registry: EntityRegistry, issues: RepairIssues): (entityId: string) => boolean {
  return (entityId) => {
    const ids = issues.value();
    if (ids === undefined || !issues.settled() || registry.version() === undefined) return true;
    const entry = registry.entry(entityId);
    return entry === undefined || ids.has(`${SEGMENTS_CHANGED}${entry.registryId}`);
  };
}
