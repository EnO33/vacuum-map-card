import { css } from "lit";
import { iconButtonStyles } from "./icon-button";
import { outlinedButtonStyles } from "./outlined-button";

/**
 * The picker's content: one row per robot, a 44 px touch target for every control (ADR 0004 « Touch targets »), theme
 * variables only. The state dot copies the frontend's colour chain for the vacuum state (ADR 0004 « State colours »,
 * `docs/research/ha-frontend.md` § 6); its text label says the same, so colour is never the only signal.
 */
export const robotPickerStyles = [
  outlinedButtonStyles,
  iconButtonStyles,
  css`
  :host {
    display: block;
    color: var(--primary-text-color, #141414);
  }
  h2 {
    margin: 0 0 var(--ha-space-2, 8px);
    /* Room for a host's control beside the name (the picker window's close button), as tall as it. */
    display: flex;
    align-items: center;
    min-height: var(--vmc-heading-height, auto);
    padding-inline-end: var(--vmc-heading-end, 0);
    font-size: var(--ha-font-size-l, 16px);
    font-weight: var(--ha-font-weight-medium, 500);
  }
  /* Focused only so a picker with no robot to start has somewhere to put the focus: not a control, no ring. */
  h2:focus {
    outline: none;
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .robots > li {
    display: flex;
    gap: var(--ha-space-1, 4px);
    align-items: flex-start;
  }
  .robots > li + li {
    margin-top: var(--ha-space-1, 4px);
  }
  .robot {
    box-sizing: border-box;
    flex: 1;
    min-width: 0;
    min-height: 44px;
    padding: var(--ha-space-2, 8px) var(--ha-space-3, 12px);
    border-radius: var(--ha-border-radius-md, 8px);
    text-align: start;
  }
  /* A robot that can start has the room list's outlined look, so it reads as a button without hover (touch). */
  button.choose {
    margin: 0;
  }
  .name,
  .cleans,
  .cannot {
    display: block;
    overflow-wrap: anywhere;
  }
  .name {
    font-weight: var(--ha-font-weight-medium, 500);
  }
  .line,
  .cleans,
  .reasons,
  .empty {
    color: var(--secondary-text-color, #5e5e5e);
  }
  .line {
    display: flex;
    overflow-wrap: anywhere;
    flex-wrap: wrap;
    gap: 0 var(--ha-space-2, 8px);
    align-items: center;
  }
  .status {
    display: inline-flex;
    gap: var(--ha-space-1, 4px);
    align-items: center;
  }
  .dot {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .dot.cleaning {
    background: var(--state-vacuum-cleaning-color, var(--state-vacuum-active-color, var(--state-active-color)));
  }
  .dot.returning {
    background: var(--state-vacuum-returning-color, var(--state-vacuum-active-color, var(--state-active-color)));
  }
  .dot.error {
    background: var(--state-vacuum-error-color, var(--state-vacuum-active-color, var(--state-active-color)));
  }
  .dot.docked {
    background: var(--state-vacuum-docked-color, var(--state-vacuum-inactive-color, var(--state-inactive-color)));
  }
  .dot.idle {
    background: var(--state-vacuum-idle-color, var(--state-vacuum-inactive-color, var(--state-inactive-color)));
  }
  .dot.paused {
    background: var(--state-vacuum-paused-color, var(--state-vacuum-inactive-color, var(--state-inactive-color)));
  }
  .dot.unavailable,
  .dot.unknown {
    background: var(--state-unavailable-color);
  }
  .cannot {
    margin-top: var(--ha-space-1, 4px);
  }
  .reasons p,
  .reasons ul {
    margin: var(--ha-space-1, 4px) 0 0;
  }
  .reasons ul {
    padding-inline-start: var(--ha-space-5, 20px);
    list-style: disc;
  }
  .empty {
    margin: 0;
  }
`,
];
