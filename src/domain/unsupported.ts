/** A typed refusal, never a throw: the caller shows a readable reason (ADR 0002). Shared by every domain module. */
export interface Unsupported<Reason extends string> {
  readonly kind: "unsupported";
  readonly reason: Reason;
}

export function unsupported<Reason extends string>(reason: Reason): Unsupported<Reason> {
  return { kind: "unsupported", reason };
}
