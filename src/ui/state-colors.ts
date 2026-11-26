import { css } from "lit";

/**
 * The vacuum state colours of ADR 0004 « State colours », written once: the frontend's chain for each state, with the
 * chain as the `var()` fallback because a custom theme may not define the first variable. No literal colour.
 */
export const STATE_COLORS = {
  cleaning: css`var(--state-vacuum-cleaning-color, var(--state-vacuum-active-color, var(--state-active-color)))`,
  returning: css`var(--state-vacuum-returning-color, var(--state-vacuum-active-color, var(--state-active-color)))`,
  error: css`var(--state-vacuum-error-color, var(--state-vacuum-active-color, var(--state-active-color)))`,
  docked: css`var(--state-vacuum-docked-color, var(--state-vacuum-inactive-color, var(--state-inactive-color)))`,
  idle: css`var(--state-vacuum-idle-color, var(--state-vacuum-inactive-color, var(--state-inactive-color)))`,
  paused: css`var(--state-vacuum-paused-color, var(--state-vacuum-inactive-color, var(--state-inactive-color)))`,
  unavailable: css`var(--state-unavailable-color)`,
} as const;
