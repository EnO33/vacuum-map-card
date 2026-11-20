---
name: tdd
description: Red-green-refactor loop for vacuum-map-card with Vitest — failing test first, least code, refactor under green, innermost layer first (domain, app, adapters, ui). Use for any new behaviour or bug fix, "/tdd", "en TDD".
argument-hint: "<behaviour to add or bug to fix>"
---

# tdd

Behaviour: `$ARGUMENTS`.

## 0. Pick the layer (innermost first)

1. `src/domain/`: pure functions and value objects (point in polygon, affine transform from calibration points, outline to SVG path, label anchor, robot eligibility). Plain tests, no fakes.
2. `src/app/`: use cases with fake ports (`HassPort`, `RoomSource`) written in the test file.
3. `src/adapters/`: parsers and room sources against anonymised fixtures in `test/fixtures/` (a fake `hass` object built from captured states; `callService` / `callWS` recorded, never real).
4. `src/ui/`: Lit elements in the DOM test environment: render with a fake `hass`, query the shadow DOM by role and accessible name, dispatch keyboard and pointer events, assert emitted events and calls. No screenshot tests.
5. `src/index.ts`: registration only, one test that the elements are defined.

## 1. Red

- One test for the smallest next behaviour, named after it: `it("offers only robots whose map contains the room")`. Use `it.each` for shared shapes.
- Run only it: `pnpm exec vitest run <file> -t "<name>"`. It must fail on the assertion, not on an import or a typo. Bug fix: the first test reproduces the bug.

## 2. Green

- The least code that passes. No option or abstraction « for later ». Re-run the test, then the file.

## 3. Refactor

- Under green only: remove duplication, rename for intent, split a function over ~40 lines or a file over ~250. Refactor tests too.

## 4. Widen, then finish

- Next cases: empty and malformed attributes, missing entities, disabled plan entity, fewer than 3 calibration points, degenerate polygons, rooms with the same name on two maps, robot states (`docked`, `cleaning`, `returning`, `paused`, `idle`, `error`, `unavailable`), RTL-safe layout, locale fallback.
- Done: `pnpm run lint`, `pnpm run typecheck`, `pnpm run test` (coverage ≥ 90 % on touched `domain` and `app` modules), `pnpm run build`.
- Commit message written with Write to `.tmp/commit-msg-<k>.txt`, committed with `git commit -F`.

## Rules

- No production code without a failing test that asked for it. Never weaken or delete a test to get green.
- No network, no real Home Assistant, no real clock (`vi.useFakeTimers()` or an injected `now()`), no sleeps, no order dependence.
- Fixtures are real captures, anonymised, with source, integration version and date in a sibling `.md`.
- No `git stash`: commit work in progress on your branch (the PR is squash-merged).
