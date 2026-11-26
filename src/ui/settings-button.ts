import { html, type TemplateResult } from "lit";

/** Home Assistant's « more info » event; its app root opens the dialog (`docs/research/ha-frontend.md` § 11). */
export const MORE_INFO_EVENT = "hass-more-info";

/**
 * A button that opens an entity's settings in Home Assistant's own dialog: `hass-more-info` with `view: "settings"`,
 * as the built-in map card does, for an enabled or a disabled entity (`docs/research/ha-frontend.md` § 14,
 * undocumented). The caller renders it for an administrator only (ADR 0003 « Permissions », ADR 0005 « Plan pictures »
 * item 5). The card writes nothing: the user enables the entity or maps the segments in that dialog. The event leaves
 * from the clicked button, which is connected, and crosses the shadow roots up to the app root. `label` is the visible
 * text; the accessible name adds `planName` (its floor, or its map and robot), so buttons on plans side by side are told
 * apart.
 */
export function settingsButton(entityId: string, label: string, planName: string): TemplateResult {
  const open = (event: Event) =>
    event.currentTarget?.dispatchEvent(
      new CustomEvent(MORE_INFO_EVENT, { detail: { entityId, view: "settings" }, bubbles: true, composed: true }),
    );
  return html`<button
    type="button"
    class="outlined-button settings-button"
    aria-label=${`${label}, ${planName}`}
    @click=${open}
  >
    ${label}
  </button>`;
}
