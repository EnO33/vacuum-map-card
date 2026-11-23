import { caseFold } from "./case-fold";
import { withinTextCap } from "./limits";

const PLAIN_REGION_ID = /^[A-Za-z0-9_]+$/;

/**
 * Generous keys for the shadow check of ADR 0003 « Path 2 ». Roomba+ 4.6.5 resolves a requested `room_name`
 * (`match_room_names`, room_cleaning.py L82-L145) by, in order:
 * 1. `request.strip().casefold()` against `name.casefold()` (the stored name is not stripped);
 * 2. `room_slug(request)` against `room_slug(name)` (const.py L3340-L3365: NFD, combining marks dropped, runs
 *    outside `[a-zA-Z0-9]` turned into `_`, stripped of `_`, lower-cased, `room` when empty);
 * 3. the bare id.
 * Here the request is a region id made of `[A-Za-z0-9_]`, and `k(t)` keeps the ASCII letters and digits of `t`,
 * lower-cased, or `room` when none are left. Then:
 * - `k(room_slug(x)) === k(NFD(x))` for every `x`, since combining marks are never ASCII letters or digits and both
 *   fall back to `room` alike; so a slug match implies `k(NFD(name)) === k(id)`;
 * - a casefold match means `casefold(name) === lower(id)`, so `k(casefold(name)) === k(id)`;
 * - the NFKD key also catches compatibility forms (fullwidth letters, ligatures) for safety.
 * Matching too much only withdraws path 2, which is the safe side. Exported so #53 can key each name once.
 */
export function shadowKeys(s: string): ReadonlySet<string> {
  return new Set([key(s.normalize("NFD")), key(s.normalize("NFKD")), key(caseFold(s))]);
}

/** True when the name could make Roomba+ resolve `regionId` to another room. */
export function mayShadow(name: string, regionId: string): boolean {
  const nameKeys = shadowKeys(name);
  for (const k of shadowKeys(regionId)) if (nameKeys.has(k)) return true;
  return false;
}

/** Only such ids get path 2: the shadow check above is proven for them alone. */
export function isPlainRegionId(id: string): boolean {
  return withinTextCap(id) && PLAIN_REGION_ID.test(id);
}

/** ASCII letters and digits only, lower-cased (ASCII, so locale-free); `room` when nothing is left. */
function key(t: string): string {
  const kept = t.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
  return kept === "" ? "room" : kept;
}
