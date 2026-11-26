import { css, html, svg, type TemplateResult } from "lit";

export type NoticeKind = "info" | "warning";

/** The icons, drawn here: an « i » or a « ! » in a circle, so the kind is never told by colour alone. */
const ICON_MARKS: Readonly<Record<NoticeKind, TemplateResult>> = {
  info: svg`<path d="M12 11v6M12 7v.01" />`,
  warning: svg`<path d="M12 7v6M12 17v.01" />`,
};

/** Home Assistant's alert look (`ha-alert`): a background tinted with the kind's colour, its icon, the theme's text. */
export const noticeStyles = css`
  .notice {
    position: relative;
    display: flex;
    gap: var(--ha-space-2, 8px);
    align-items: flex-start;
    margin-top: var(--ha-space-2, 8px);
    padding: var(--ha-space-2, 8px);
    border-radius: var(--ha-border-radius-sm, 4px);
  }
  .notice::after {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background-color: var(--notice-color);
    opacity: 0.12;
    pointer-events: none;
    content: "";
  }
  .notice-info {
    --notice-color: var(--info-color, #039be5);
  }
  .notice-warning {
    --notice-color: var(--warning-color, #ffa600);
  }
  .notice svg {
    flex: none;
    width: 24px;
    height: 24px;
    color: var(--notice-color);
  }
  .notice p,
  .notice ul {
    margin: 0;
  }
  .notice p + p,
  .notice p + ul,
  .notice ul + p {
    margin-top: var(--ha-space-1, 4px);
  }
  .notice ul {
    padding-inline-start: var(--ha-space-5, 20px);
  }
  /* A button in a note keeps its focus ring clear of the lines around it. */
  .notice .notice-action {
    margin-block: var(--ha-space-2, 8px);
  }
`;

/**
 * A note that stays on the card: `role="note"`, never a live region, so it is read in place and not announced on every
 * render. Home Assistant's `ha-alert` is not used: it renders `role="alert"` (`docs/research/ha-frontend.md`).
 * `content` must be text, or the card's own controls built from text.
 */
export function notice(kind: NoticeKind, content: TemplateResult): TemplateResult {
  return html`<div class="notice notice-${kind}" role="note">
    ${noticeIcon(kind)}
    <div>${content}</div>
  </div>`;
}

/** The kind's icon, decorative: the text next to it says what it means. */
export function noticeIcon(kind: NoticeKind): TemplateResult {
  return html`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <circle cx="12" cy="12" r="9" />
    ${ICON_MARKS[kind]}
  </svg>`;
}

/** Lines as one paragraph, or as a list when there are several. */
export function noticeLines(lines: readonly string[]): TemplateResult {
  return lines.length === 1 ? html`<p>${lines[0]}</p>` : html`<ul>${lines.map((line) => html`<li>${line}</li>`)}</ul>`;
}
