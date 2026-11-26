import { css } from "lit";
import { dialogSurfaceStyles } from "./dialog-surface.styles";
import { iconButtonStyles } from "./icon-button";

/**
 * The picker's window from theme variables only (ADR 0004 « Native look, not native elements »). The popover has the
 * surface, radius and shadow of Home Assistant's dialogs and no scrim; the bottom sheet reads the `--ha-bottom-sheet-*`
 * hooks a theme may set (`docs/research/ha-frontend.md` § 4), full width, its height capped, its content scrolling.
 * Opening fades and slides in over `--ha-animation-duration-fast`, which Home Assistant shortens to 1 ms under
 * `prefers-reduced-motion`; the card's own media query removes it too.
 */
export const pickerDialogStyles = [
  dialogSurfaceStyles,
  iconButtonStyles,
  css`
  :host {
    --vmc-picker-duration: var(--ha-animation-duration-fast, 150ms);
    --vmc-sheet-radius: var(--ha-bottom-sheet-border-radius, var(--ha-border-radius-3xl, 24px));
  }

  dialog {
    padding: 0;
    transition:
      opacity var(--vmc-picker-duration) ease-out,
      transform var(--vmc-picker-duration) ease-out,
      overlay var(--vmc-picker-duration) allow-discrete,
      display var(--vmc-picker-duration) allow-discrete;
  }

  /* Closing: where the browser can animate display and overlay, the window fades and slides out. */
  dialog:not([open]) {
    opacity: 0;
    transform: translateY(8px);
  }

  .sheet:not([open]) {
    transform: translateY(100%);
  }

  dialog::backdrop {
    transition:
      opacity var(--vmc-picker-duration) ease-out,
      overlay var(--vmc-picker-duration) allow-discrete,
      display var(--vmc-picker-duration) allow-discrete;
  }

  dialog:not([open])::backdrop {
    opacity: 0;
  }

  .popover {
    width: min(360px, calc(100vw - 16px));
    max-height: calc(100vh - 16px);
    max-height: calc(100dvh - 16px);
  }

  /* Placed by the card next to its room, in viewport coordinates; centred by the browser otherwise. */
  .popover[data-anchored] {
    margin: 0;
    right: auto;
    bottom: auto;
  }

  .popover::backdrop {
    background: transparent;
  }

  .sheet {
    width: 100%;
    max-width: var(--ha-bottom-sheet-max-width, 100%);
    max-height: var(--ha-bottom-sheet-max-height, 90vh);
    max-height: var(--ha-bottom-sheet-max-height, 90dvh);
    margin: auto auto 0;
    border-radius: var(--vmc-sheet-radius) var(--vmc-sheet-radius) 0 0;
    background: var(--ha-bottom-sheet-surface-background, var(--card-background-color, var(--ha-color-surface-default)));
  }

  .sheet::backdrop {
    background-color: var(--ha-bottom-sheet-scrim-color, var(--wa-color-overlay-modal, rgb(0 0 0 / 0.25)));
  }

  @starting-style {
    dialog[open] {
      opacity: 0;
      transform: translateY(8px);
    }
    .sheet[open] {
      transform: translateY(100%);
    }
    dialog[open]::backdrop {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    dialog,
    dialog::backdrop {
      transition: none;
    }
  }

  .surface {
    position: relative;
    padding: var(--ha-space-4, 16px);
  }

  /* Clear of the home indicator on phones that have one. */
  .sheet .surface {
    padding-bottom: calc(var(--ha-space-4, 16px) + env(safe-area-inset-bottom, 0px));
  }

  /* Leaves room for the close button beside the room's name, on a row as tall as it. */
  vmc-robot-picker {
    --vmc-heading-end: 48px;
    --vmc-heading-height: 44px;
  }

  /* After the list in the focus order, drawn on the heading row, in the column of the robots' details buttons. */
  button.close {
    position: absolute;
    top: var(--ha-space-4, 16px);
    inset-inline-end: var(--ha-space-4, 16px);
  }

  button.close svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }
`,
];
