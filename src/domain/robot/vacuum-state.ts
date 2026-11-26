/** The states core gives a vacuum (`docs/research/ha-core-vacuum.md`, `const.py#L32-L40` at 2026.11.2). */
export const VACUUM_STATES = ["cleaning", "docked", "idle", "paused", "returning", "error"] as const;

export type VacuumState = (typeof VACUUM_STATES)[number];

const KNOWN: ReadonlySet<string> = new Set(VACUUM_STATES);

/** Whether `state` is one of core's vacuum states; `unavailable`, `unknown` and any other code are not. */
export function isVacuumState(state: string | undefined): state is VacuumState {
  return state !== undefined && KNOWN.has(state);
}
