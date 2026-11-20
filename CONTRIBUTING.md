# Contributing

Thanks for helping. This file is binding for every contribution, human or automated.

## Ground rules

- One issue, one branch, one pull request. Branch names: `feat/…`, `fix/…`, `refactor/…`, `docs/…`, `ci/…`, `chore/…`.
- Commits and PR titles follow Conventional Commits 1.0.0, imperative, lower case. Scopes: `domain`, `app`, `adapters`, `ui`, `editor`, `i18n`, `build`, `docs`, `ci`. The body explains why.
- PR body: `## What`, `## Why`, `## Risk`, `## Validation` (commands run, Home Assistant version tested, screenshots in light and dark mode for UI changes), then `Closes #<n>`.
- Tests come first (red, green, refactor). Every behaviour has a test that fails without it. Tests never touch the network or a real Home Assistant.
- Strict TypeScript: no `any`, no non-null assertions, no unchecked casts, no `@ts-ignore`.
- Never commit anything personal: no IP address, entity id, room name, floor plan or screenshot of a real home. Fixtures are anonymised.

## Checks

### Development

You need Node.js and pnpm at the versions in `docs/standards.md`. The Node.js version is read from `engines.node` in `package.json`, and pnpm from its `packageManager` field: install any recent pnpm (pnpm.io/installation) and it switches to that version by itself.

All green before you push:

```
pnpm install --frozen-lockfile
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

## Versioning

Semantic versioning. Patch: fixes, docs, internal refactors. Minor: a new feature, option or integration adapter. Major: a breaking change for users (removed or renamed option, raised minimum Home Assistant version).

## Adding an integration

The card gets room outlines from a *room source* adapter, one per vacuum integration (`src/adapters/<integration>/`). To add one:

1. Open an issue with the integration name, its repository and the entities it exposes for maps and rooms.
2. Document the data model in `docs/research/<integration>.md`: integration version, date, which entities and attributes carry the floor plan, the room outlines, the calibration between robot coordinates and image pixels, and the action that cleans a room. Paste anonymised captures, never real ones.
3. Implement the `RoomSource` port with tests against those captures.
4. Add the integration to the table in both READMEs.

## Translations

User-visible strings live in `src/i18n/<language>.json`. A new string goes into every file in the same PR; French and English ship together.
