# ADR 0004: UX and visual principles

- Status: accepted
- Date: 2026-11-20

## Context

The owner explicitly rejects the « AI-generated » look (decorative gradients, glow, glass effects, emoji, pills everywhere) and also finds a bare stack of default cards too plain. The card must feel like a first-party Home Assistant card that was designed with care.

## Decision

- **Native base** (amended 2026-11-24: « native look », see « Amendment »): `ha-card`, Home Assistant typography, spacing and radius, theme CSS variables only (no hard-coded colours), correct in light and dark themes and with custom themes.
- **One accent**: the theme's primary colour marks the selected room and the active robot; state colours (`--state-*` variables) mark cleaning, done and error. Their names, « à vérifier » until 2026-11-24, are verified in « Amendment ».
- **Floor plans first**: plans are the largest elements; labels sit on the rooms, readable at tablet size; the room hover/focus state is a subtle fill and outline, not a glow.
- **Progressive disclosure**: the robot picker appears anchored to the room (popover on desktop, bottom sheet on narrow screens); the confirmation is a native-looking dialog. Amended 2026-11-24: the picker is the card's own element and the confirmation is Home Assistant's standard one (« Amendment »).
- **Motion**: only short, purposeful transitions (opening the picker, a room entering a new state), disabled with `prefers-reduced-motion` (tokens and limits in « Amendment »).
- **Accessibility**: every room is a focusable element with a name; arrow keys move between rooms; Enter opens the picker; Escape closes; contrast AA; touch targets ≥ 44 px.
- **Copy**: short, concrete, no exclamation marks, no emoji.

## Consequences

- Every UI pull request includes screenshots in light and dark mode and passes `ux-reviewer`.

## Amendment (2026-11-24)

The frontend research of Epic 5 ([`ha-frontend.md` « Epic 5: UI facts »](../research/ha-frontend.md#epic-5-ui-facts), checked 2026-11-24 against frontend 20261028.6, Home Assistant 2026.11.2) shows that the decision above relied on `ha-*` elements that the frontend does not promise. This amendment replaces « Native base », the state colour names of « One accent » and the picker and dialog of « Progressive disclosure ». It also sets the tokens for focus, motion and touch targets. The rest of the decision is unchanged. Sources: [« Differences with ADR 0004 and the earlier sections »](../research/ha-frontend.md#differences-with-adr-0004-and-the-earlier-sections), [« Gaps for this card »](../research/ha-frontend.md#gaps-for-this-card).

### Native look, not native elements

- The card looks native: Home Assistant's theme variables, its typography, spacing and radius tokens, and its standard confirmation. It does not build on `ha-*` elements.
- `ha-card` is the only `ha-*` element used unconditionally.
- Any other `ha-*` element is used only after `customElements.get(tag)` returns a class, with a plain-HTML fallback (`<button>`, `<svg>`, `<div role="status">`) styled by theme variables.
- `ha-adaptive-popover`, `ha-adaptive-dialog`, `ha-bottom-sheet`, `ha-dialog`, `ha-list-item`, `ha-list-item-button` and `ha-form` are never rendered by the card. The visual editor gets `ha-form` only through `getConfigForm()`, where Home Assistant renders it.

Sources:

- [« The general rule for `ha-*` elements »](../research/ha-frontend.md#the-general-rule-for-ha--elements): the frontend says to build or bundle your own pickers and to reach the standard dialogs through the card helpers;
- [§ 3 « Dialogs »](../research/ha-frontend.md#3-dialogs), [§ 4 « Popover and bottom sheet »](../research/ha-frontend.md#4-popover-and-bottom-sheet), [§ 5 « Other components on a dashboard »](../research/ha-frontend.md#5-other-components-on-a-dashboard), [§ 8 « Visual editor »](../research/ha-frontend.md#8-visual-editor);
- [« Gaps for this card », item 1](../research/ha-frontend.md#gaps-for-this-card).

### Robot picker

The robot picker is the card's own element. It is anchored to the room on wide screens. It is a bottom sheet when `(max-width: 870px), (max-height: 500px)` matches, the breakpoint Home Assistant uses for its adaptive dialogs. `ha-adaptive-popover`, which does exactly this, is not defined on a dashboard. Source: [§ 4 « Popover and bottom sheet »](../research/ha-frontend.md#4-popover-and-bottom-sheet).

The picker is a dialog named after the room (`role="dialog"`), and it takes the focus when it opens.

### Confirmation

The confirmation uses Home Assistant's standard confirmation through the card helpers (`showConfirmationDialog`). Built-in cards use the same one to confirm a tap action. This is the owner's decision of 2026-11-24 (epic #97 « Owner decisions », item 1). The card passes its own `title`, `text` (a plain string), `confirmText` and `dismissText`, and `destructive: false`, so Home Assistant's defaults (« Are you sure? », « OK ») never show.

The card's own confirmation dialog, with the same wording and buttons, is the fallback when the helpers are missing: `window.loadCardHelpers` absent, its import rejected, or no `showConfirmationDialog` in the result. Like the standard one, Escape cancels it.

The result of the start shows on the card and the room after the dialog closes, not inside it (ADR 0003 « Amendment (2026-11-24) »). Sources: [§ 3 « Dialogs »](../research/ha-frontend.md#3-dialogs), [« Gaps for this card », items 2 and 3](../research/ha-frontend.md#gaps-for-this-card).

### Focus and closing

- The picker closes before the confirmation opens, so one Escape never closes two layers.
- A card has at most one confirmation open at a time.
- When the confirmation resolves (confirmed or cancelled), and when the picker closes without a choice, the card moves the focus back to the room. The standard confirmation lives outside the card, and the element that had the focus before it opened (a row of the closed picker) is gone.

### State colours

Cleaning, paused and error copy the frontend's chain for that vacuum state; the chain is their `var()` fallback, because a custom theme may not define the first variable. Done and unavailable are global theme variables with no frontend chain. No literal colour is written (« Native base »).

| Progress on a room (ADR 0003 « Amendment ») | Colour |
|---|---|
| Cleaning | `var(--state-vacuum-cleaning-color, var(--state-vacuum-active-color, var(--state-active-color)))` |
| Paused | `var(--state-vacuum-paused-color, var(--state-vacuum-inactive-color, var(--state-inactive-color)))` (the frontend counts `paused` as an inactive state) |
| Failed | `var(--state-vacuum-error-color, var(--state-vacuum-active-color, var(--state-active-color)))` (the frontend counts `error` as an active state) |
| Done | `var(--success-color)`: « done » is not a vacuum state, so it has no state colour |
| Status unknown | `var(--state-unavailable-color)` |
| Sending, starting, may have started, not started | No state colour: the text label and an icon carry them |

`--state-vacuum-cleaning-color` is not defined by default. A theme may set it, and the chain reads it first; otherwise `cleaning` resolves to `--state-vacuum-active-color`. Source: [§ 6 « Theme CSS variables »](../research/ha-frontend.md#6-theme-css-variables), table « How the frontend colours a vacuum state ».

Colour is never the only signal: each state also has a text label.

### Selection accent

The selected room and the active robot use `--primary-color`. Fills use `rgba(var(--rgb-primary-color), <alpha>)`. Source: [§ 6 « Theme CSS variables »](../research/ha-frontend.md#6-theme-css-variables).

Selection, progress and focus can apply to one room at once, and in the default theme `--primary-color` (`#009ac7`) and the cleaning colour (`#009688`) are close. So each uses its own channel: selection is the room's stroke, progress is a light fill with its label, and focus is a ring outside the shape. All three stay distinguishable together.

### Focus

Focus uses `--ha-color-focus` with a `--primary-color` fallback, 2 px wide, offset 2 px, on `:focus-visible`. There is no global `--ha-focus-ring`. On SVG shapes the card draws a stroke on focus until the live check of the Epic 5 research issue (#99) confirms `outline` there. Source: [§ 10 « Focus rings »](../research/ha-frontend.md#10-focus-rings).

The ring must reach 3:1 against the colours next to it (WCAG 1.4.11). In the default light theme `--ha-color-focus` (`#989898`) on the card background (`#ffffff`) is about 2.9:1, and over a plan picture it is unknown. This is open: the focus UI issue checks it, and the owner chooses the fix if it fails (« Open points »).

### Motion

Transitions use the `--ha-animation-duration-*` tokens (`instant`, `fast`, `normal`, `slow`). Home Assistant sets them to 1 ms under `prefers-reduced-motion: reduce`. Keyframe animations also get their own `prefers-reduced-motion` media query. Source: [§ 6 « Theme CSS variables »](../research/ha-frontend.md#6-theme-css-variables).

No animation repeats indefinitely: a room being cleaned is shown by a static fill, icon and label, and motion is only for transitions.

### Touch targets

Touch targets are at least 44 px. `ha-button` defaults to 40 px, so when the card uses it, it sets `size="l"` or `--ha-button-height`. The card's own buttons, including the control that dismisses a room's progress, are at least 44 px. Sources: [§ 5 « Other components on a dashboard »](../research/ha-frontend.md#5-other-components-on-a-dashboard), [« Gaps for this card », item 7](../research/ha-frontend.md#gaps-for-this-card).

A room outline scales with its plan, so a small room can be under 44 px on a phone. How such a room stays reachable is open (« Open points »).

### Consequences

- Screenshots in pull requests come only from the demo page on anonymised fixtures, never from a real home. This narrows « Every UI pull request includes screenshots » above, and the « demo or anonymised setup » of `.claude/skills/ha-live-test/SKILL.md` step 6. The demo page sets Home Assistant's default light and dark theme variables (values in [§ 6 « Theme CSS variables »](../research/ha-frontend.md#6-theme-css-variables)), so the screenshots show the themed look, not the `var()` fallbacks. A UI pull request shows a wide and a narrow width when the picker is involved.
- A frontend release can stop defining an `ha-*` element on a dashboard. The `customElements.get` checks and plain fallbacks keep the card working. The accidental import chains are re-checked at every frontend bump ([« Gaps for this card », item 13](../research/ha-frontend.md#gaps-for-this-card)).
- Still « à vérifier », in the Epic 5 research issue (#99): which `ha-*` elements are defined live on a dashboard, `outline` on focused SVG shapes, and picker clipping inside `ha-card`.

### Open points

These are left to the UI issue that builds each part. Any public choice among them goes to the owner:

1. Focus ring contrast in the light theme and over plan pictures (« Focus »).
2. How a room smaller than 44 px stays reachable, for example a larger hit area or the room list (« Touch targets »).
