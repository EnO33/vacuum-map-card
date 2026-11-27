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

All green before you push. CI runs the same commands on every pull request as the `checks` job:

```
pnpm install --frozen-lockfile
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
node --test scripts/test-hooks.mjs
```

### Demo page

```
pnpm run demo
```

Serves a development-only page at http://localhost:5173 (this machine only; the command stops if that port is taken) that renders the card from `src/` on a fake `hass` built from the anonymised fixtures of `test/fixtures/`, with invented plan pictures from `demo/plans/`. The page switches the theme (Home Assistant's light and dark variables), the card width (phone 400 px, tablet 800 px, wide), how a clean is answered (accepted, refused, or never answered), what the robots report (the captured states, or one state for both) and which plans are shown (all, or only those on a floor: the card's `floors` option set to every demo floor, so « Plans without a floor » is hidden). Choices are kept in the address, for example `?theme=dark&width=phone&outcome=refused&plans=floors`. Actions only reach the fake and are listed under the card; nothing leaves the page.

Screenshots in a pull request come from this page (light and dark), never from a real home. Nothing under `demo/` is bundled: `pnpm run build` fails if a file outside `src/` and the dependencies reaches `dist/`.

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
