# Home Assistant frontend: custom card contract

Status: **verified** on 2026-11-20 against Home Assistant 2026.11.2 and its frontend 20261028.6. Re-check at every `/check-versions` that moves the latest Home Assistant release, and before relying on a fact not listed here.

## Versions

| Fact | Source | Checked |
|---|---|---|
| Home Assistant 2026.11.2 ships `home-assistant-frontend==20261028.6` | `homeassistant/components/frontend/manifest.json` at tag `2026.11.2` (`gh api repos/home-assistant/core/contents/...?ref=2026.11.2`) | 2026-11-20 |

## Facts the card relies on

| Fact | Source | What the card does if it changes or is missing |
|---|---|---|
| A card is a custom element; `setConfig(config)` is required and is called when the card is created and when its configuration changes | https://contributors.home-assistant.io/frontend/custom-ui/card/ (formerly developers.home-assistant.io; no date on the page), card API table | `VacuumMapCard.setConfig` stores the config. A new required method would show as a Home Assistant error on the card, caught by `/ha-live-test` |
| Throwing an `Error` in `setConfig` makes Home Assistant show the error instead of the card | same page, « Throw an error and Home Assistant shows it instead of the card » | Not used yet; config validation (Epic 5) relies on it |
| `hass` is set on every state change in the home (« often »); optional | same page | Stored and ignored for now: it does not re-render the card |
| `getCardSize()` is optional, default 1, in units of 50 px (masonry view); `getGridOptions()` is optional, without it the card takes the full section width and its height follows its content | same page | Not implemented yet (out of scope of #8) |
| The YAML type is `custom:` plus the registered tag name | same page, « becomes the type `custom:state-card-example` » | Element registered as `vacuum-map-card`, YAML `type: custom:vacuum-map-card` |
| The resource is loaded as a JavaScript module; cards load lazily | same page | Single ES module in `dist/` |
| `ha-card` gives the built-in cards their background, border and shadow and follows the theme, but « Like every `ha-*` element, it is not a promised API » | same page | The title is a light-DOM child of `ha-card`, so it stays readable as plain text if `ha-card` is not defined |
| `window.customCards` entries are `{ type: string; name?; description?; preview?: boolean; documentationURL?; getEntitySuggestion? }`; the frontend creates `window.customCards = []` when it is missing, then keeps a reference to that array (`export const customCards = customCardsWindow.customCards!`), and the card picker reads that reference, not `window.customCards` | frontend `src/data/lovelace_custom_cards.ts` (`CustomCardEntry`, module body) and `src/panels/lovelace/editor/card-editor/hui-card-picker.ts` (`import { customCards }`) at tag `20261028.6` | The card treats the list as untrusted and pushes its entry once into the existing array, never into a copy, so the picker sees it. A non-array value is replaced by a new array; if the frontend already read that value, the card is missing from the picker but YAML still works |
| The card picker prefixes `custom:` (`CUSTOM_TYPE_PREFIX`) to the entry's `type`, so `type` is the bare element name | frontend `src/panels/lovelace/editor/card-editor/hui-card-picker.ts` and `src/data/lovelace_custom_cards.ts` at tag `20261028.6` | Entry `type` is `vacuum-map-card`; a change would only hide the card from the picker, YAML still works |
| `ha-card` (Lit element) has properties `header` (renders `<h1 class="card-header">` in its shadow root) and `raised`, and styles a slotted `.card-header` with theme variables (`--ha-card-header-color`, `--ha-card-header-font-size`, spacing tokens) | frontend `src/components/ha-card.ts` at tag `20261028.6` | The card renders `<h1 class="card-header">` as a slotted child, the same markup `ha-card` uses for its own header, so it gets the native header style |

## Not documented on the contract page

- `window.customCards` is not described on the contributors page; the shape above comes from the frontend source only.
- Nothing is said about a console banner. The card logs one `console.info` line with its name and version (project choice, #8) so the loaded version can be read in the browser console.
