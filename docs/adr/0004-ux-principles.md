# ADR 0004: UX and visual principles

- Status: accepted
- Date: 2026-11-20

## Context

The owner explicitly rejects the « AI-generated » look (decorative gradients, glow, glass effects, emoji, pills everywhere) and also finds a bare stack of default cards too plain. The card must feel like a first-party Home Assistant card that was designed with care.

## Decision

- **Native base**: `ha-card`, Home Assistant typography, spacing and radius, theme CSS variables only (no hard-coded colours), correct in light and dark themes and with custom themes.
- **One accent**: the theme's primary colour marks the selected room and the active robot; state colours (`--state-*` variables, « à vérifier ») mark cleaning, done and error.
- **Floor plans first**: plans are the largest elements; labels sit on the rooms, readable at tablet size; the room hover/focus state is a subtle fill and outline, not a glow.
- **Progressive disclosure**: the robot picker appears anchored to the room (popover on desktop, bottom sheet on narrow screens); the confirmation is a native-looking dialog.
- **Motion**: only short, purposeful transitions (opening the picker, a room being cleaned), disabled with `prefers-reduced-motion`.
- **Accessibility**: every room is a focusable element with a name; arrow keys move between rooms; Enter opens the picker; Escape closes; contrast AA; touch targets ≥ 44 px.
- **Copy**: short, concrete, no exclamation marks, no emoji.

## Consequences

- Every UI pull request includes screenshots in light and dark mode and passes `ux-reviewer`.
