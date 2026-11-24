import { withinTextCap } from "../text/limits";
import { type Unsupported, unsupported } from "../unsupported";
import { MAX_LAST_SEEN_SEGMENTS } from "./limits";

/** One entry of `options.vacuum.last_seen_segments`, already typed by the adapter. */
export interface LastSeenSegment {
  readonly id: string;
  readonly name: string;
}

/** `unreadable`: the list could not be read at all (not the documented shape, or not available yet). */
export type LastSeenFailure = "too_many_entries" | "duplicate_segment_id" | "text_too_long" | "unreadable";

/**
 * The name each segment was last seen with, read apart from `area_mapping` so that refusing one never hides the
 * other. What an unsupported list withholds from the robot is decided by the eligibility rules (ADR 0002
 * « Parsing limits » item 3, ADR 0003), not here.
 */
export type LastSeen =
  | { readonly kind: "names"; readonly names: ReadonlyMap<string, string> }
  | { readonly kind: "absent" }
  | Unsupported<LastSeenFailure>;

/** Names keyed by segment id, exactly as stored; the whole list is refused over a cap or on a duplicate id. */
export function readLastSeen(entries: readonly LastSeenSegment[] | undefined): LastSeen {
  if (entries === undefined) return { kind: "absent" };
  if (entries.length > MAX_LAST_SEEN_SEGMENTS) return unsupported("too_many_entries");
  const names = new Map<string, string>();
  for (const { id, name } of entries) {
    if (!withinTextCap(id) || !withinTextCap(name)) return unsupported("text_too_long");
    if (names.has(id)) return unsupported("duplicate_segment_id");
    names.set(id, name);
  }
  return { kind: "names", names };
}

/** The segment's name exactly as last stored, or `undefined` when unknown or when the list is not usable. */
export function lastSeenName(lastSeen: LastSeen, segmentId: string): string | undefined {
  return lastSeen.kind === "names" ? lastSeen.names.get(segmentId) : undefined;
}
