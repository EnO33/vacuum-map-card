/**
 * What a robot does when it is started, named in the confirmation dialog (ADR 0003 « Confirmation »). It comes from
 * the integration's adapter, never from core, which has no notion of mopping. `clean` is the neutral verb used when
 * the robot's own setting decides (the owner's exception to point 3, #37).
 */
export type ActionKind = "vacuum" | "mop" | "vacuum_and_mop" | "vacuum_then_mop" | "clean";
