import { css } from "lit";
import { dialogSurfaceStyles } from "./dialog-surface.styles";

/**
 * Home Assistant's confirmation look, from theme variables only (ADR 0004 « Native look, not native elements »).
 * Sizes, radius, shadow and title come from `ha-dialog` and `ha-button` (frontend 20261028.6): a dialog with the
 * `--ha-dialog-*` overrides a theme may set, a plain dismiss button and a primary confirm button, both 44 px high.
 */
export const confirmDialogStyles = [
  dialogSurfaceStyles,
  css`
  dialog {
    width: min(var(--ha-dialog-width-md, 580px), 95vw);
    max-height: calc(100vh - var(--ha-space-20, 80px));
    max-height: calc(100dvh - var(--ha-space-20, 80px));
    padding: var(--ha-space-6, 24px);
  }

  h2,
  p {
    overflow-wrap: anywhere;
  }

  h2 {
    margin: 0 0 var(--ha-space-4, 16px);
    color: var(--ha-dialog-header-title-color, var(--primary-text-color));
    font-size: var(--ha-dialog-header-title-font-size, var(--ha-font-size-2xl, 24px));
    font-weight: var(--ha-dialog-header-title-font-weight, var(--ha-font-weight-normal, 400));
    line-height: var(--ha-dialog-header-title-line-height, var(--ha-line-height-condensed, 1.2));
  }

  p {
    margin: 0;
    font-size: var(--ha-font-size-m, 14px);
    line-height: var(--ha-line-height-normal, 1.6);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--ha-space-2, 8px);
    margin-top: var(--ha-space-6, 24px);
  }

  button {
    min-width: 44px;
    min-height: 44px;
    padding: 0 var(--ha-space-4, 16px);
    border: 1px solid transparent;
    border-radius: var(--ha-button-border-radius, var(--ha-border-radius-pill, 9999px));
    font: inherit;
    font-size: var(--ha-font-size-m, 14px);
    font-weight: var(--ha-font-weight-medium, 500);
    cursor: pointer;
  }

  button:focus-visible {
    outline: 2px solid var(--ha-color-focus, var(--primary-color));
    outline-offset: 2px;
  }

  .dismiss {
    background: none;
    color: var(--primary-color);
  }

  .dismiss:hover {
    background: rgba(var(--rgb-primary-color), 0.08);
  }

  .confirm {
    background: var(--primary-color);
    color: var(--text-primary-color);
  }

  .confirm:hover {
    box-shadow: inset 0 0 0 100vmax rgba(var(--rgb-text-primary-color), 0.12);
  }
`,
];
