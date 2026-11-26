import { css } from "lit";

/**
 * The surface the card's own dialogs share (confirmation, robot picker): Home Assistant's dialog look from theme
 * variables only, with the `--ha-dialog-*` overrides a theme may set, and Web Awesome's scrim (ADR 0004 « Native look,
 * not native elements »; `ha-dialog`, frontend 20261028.6). Each dialog adds its size, padding and placement.
 */
export const dialogSurfaceStyles = css`
  :host {
    /* Not "none": a top-layer dialog is not rendered when an ancestor has display: none. */
    display: contents;
  }

  dialog {
    box-sizing: border-box;
    overflow: auto;
    overscroll-behavior: contain;
    /* Transparent until forced colours (high contrast) draw it: the only edge the dialog has there. */
    border: 1px solid transparent;
    border-radius: var(--ha-dialog-border-radius, var(--ha-border-radius-3xl, 24px));
    background: var(--ha-dialog-surface-background, var(--card-background-color, var(--ha-color-surface-default)));
    color: var(--primary-text-color);
    box-shadow: var(--dialog-box-shadow, var(--wa-shadow-l));
    font-family: var(--ha-font-family-body);
  }

  /* Web Awesome's dialog scrim, which Home Assistant's dialogs show; it defines no theme variable for it. */
  dialog::backdrop {
    background-color: var(--wa-color-overlay-modal, rgb(0 0 0 / 0.25));
  }
`;
