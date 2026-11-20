# Vacuum Map Card (Home Assistant)

Open-source Home Assistant Lovelace card (TypeScript, Lit). It shows **one floor plan per floor, side by side**, makes **every room clickable**, lets the user **pick which robot** cleans it (any vacuum able to clean that room), asks for **confirmation** (« Send Roomba S9+ to vacuum the bedroom? »), then starts the job. It **adapts by itself** to new maps, rooms and floors: no hand-written coordinates. Repo `EnO33/vacuum-map-card` (« à vérifier »: not created yet), MIT. `CONTRIBUTING.md` is binding.

Binding docs: `docs/product.md` (vision, MVP, non-goals), `docs/adr/` (decisions), `docs/standards.md` (tools and versions, checked live), `docs/research/` (integration data models: dated facts, never memory).

**Public repository.** Nothing from the owner's home is committed: no IP address, host, entity id, room name, map, coordinate or screenshot of the real house. Local details live in `CLAUDE.local.md` (Git-ignored). Test fixtures are anonymised captures.

## Architecture

One package, built to a single ES module that Home Assistant loads as a dashboard resource.

| Layer | Folder | Owns | Never does |
|---|---|---|---|
| `domain` | `src/domain/` | Geometry (polygons, hit test, affine calibration), floors, rooms, robots, eligibility | DOM, `hass`, I/O |
| `app` | `src/app/` | Use cases: build the floor model, robots for a room, start a clean; ports `HassPort`, `RoomSource` | DOM, integration specifics |
| `adapters` | `src/adapters/` | `hass` access (states, registries, `callService`, `callWS`); one **room source per integration** (`roomba-plus` first) | UI, business rules |
| `ui` | `src/ui/` | Lit elements: card, floor view, room layer, robot picker, confirm dialog, editor | Business rules, direct `hass` calls |
| entry | `src/index.ts` | `customElements.define`, `window.customCards` entry | Logic |

Imports point inwards (`ui` → `app` → `domain`; `adapters` implement `app` ports). Integration knowledge lives only in its adapter (ADR 0002). How a clean is started: ADR 0003. UX principles: ADR 0004.

## Checks

Run before every push:

```
pnpm install --frozen-lockfile
pnpm run lint        # Biome lint + format check
pnpm run typecheck   # tsc --noEmit, strict
pnpm run test        # Vitest with coverage
pnpm run build       # single ES module in dist/, size reported
node --test scripts/test-hooks.mjs   # guard rules (also run by CI)
```

- Coverage floor: 90 % lines and branches on `domain` and `app`.
- Bundle size is printed by the build and stated in every PR.
- A UI change also gets `/ha-live-test` (real Home Assistant) before merge; say when it was not run.

## Code rules

- **TDD** (`tdd` skill): failing test first, least code, refactor under green. No network, no real Home Assistant, no real clock in tests.
- **Strict types**: no `any`, no non-null `!`, no `as` except at a validated boundary, no `@ts-ignore`. Everything read from `hass` (states, attributes, registries, service responses) is parsed at the adapter boundary: attributes are untrusted and change between integration versions.
- **No duplication**: search before writing a helper; extend what exists. Files under ~250 lines, functions under ~40, one concept per file.
- **Home Assistant**: read through `hass`; write only through `hass.callService` / `hass.callWS`, never raw `fetch`. No polling: react to `hass` updates and re-render only what changed. A missing entity or malformed attribute degrades to a readable message, never an exception that breaks the dashboard.
- **Look and feel**: native Home Assistant first (`ha-card`, HA components, theme CSS variables, light and dark). No decorative gradients, glow, glassmorphism, emoji or « AI-generated » look (`ux-reviewer`). Keyboard reachable, visible focus, roles and labels, colour never the only signal, touch targets ≥ 44 px. Anything that moves a robot asks for confirmation.
- **i18n**: user-visible strings in `src/i18n/en.json` and every other locale (French ships with English).
- **Dependencies**: maintained (release in the last 6 months), licence compatible, small, justified in the PR with its size. Prefer Lit and the platform.

## No hallucination

- Never write a version, an HA API, a service, an attribute, a selector or a card option from memory: verify it (`/check-versions`, developers.home-assistant.io, the integration's source, a captured state). Unknown is written « à vérifier ».
- Integration facts go in `docs/research/<integration>.md` with integration version, date and capture method (`integration-scout` agent, `/add-adapter`).
- "Works" means the commands ran and passed, and `/ha-live-test` ran when the UI changed; say which.

## Work

- One issue, one branch (`feat/…`, `fix/…`, `refactor/…`, `docs/…`, `ci/…`, `chore/…`), one PR, squash merge **by the owner**. `/work-issue <n>` runs the loop, `/next-issue` picks, `/plan-epic` splits an idea, `/release` cuts a version.
- Conventional Commits (scopes: `domain`, `app`, `adapters`, `ui`, `editor`, `i18n`, `build`, `docs`, `ci`), body says why. PR body: `## What`, `## Why`, `## Risk`, `## Validation`, `Closes #<n>`.
- **Never mention Claude or AI** in commits, PRs, issues, release notes. No co-author line. Release notes and forum posts: ASCII only, no emojis, no em-dashes.
- Issues, PRs, code, docs and `README.md` in English; `README.fr.md` and `src/i18n/fr.json` kept in sync. Replies to users in their language. **The owner posts every public message** (issue replies, forum, Marketplace submission): draft, never post.
- Agents never merge, tag, publish, push to `main`, force-push, delete branches, create or configure repositories, or edit `.claude/settings.json` and `.claude/hooks/` (guarded, see `.claude/hooks/README.md`).
- Commit messages and issue/PR bodies are written with Write to `.tmp/` (Git-ignored) and passed with `git commit -F` / `--body-file`, never `-m` or a heredoc.
- Owner decisions carry `owner-only`: name, public wording, supported integrations, breaking config changes, a dependency over 20 kB. Ask one question before writing code.

## Token economy

- Chat replies follow `caveman` (terse, every fact kept), in French with the owner. Code, commits, issues, PRs and docs stay in full sentences.
- Delegate wide searches to Explore; read only the part of a file you need; do not re-read a file you just edited.
- Keep this file short: procedures belong in `.claude/skills/` (index: `.claude/skills/README.md`).
