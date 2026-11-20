# Standards

Binding. Every version here is checked live by `/check-versions` and dated. A row without a date is « à vérifier » and must not be used.

## Versions vérifiées

| Tool | Version | Released | Source | Checked |
|---|---|---|---|---|
| Node.js (LTS « Lithium », tooling only) | 26.13.1 | 2026-11-10 | nodejs.org/dist/index.json | 2026-11-20 |
| pnpm (`packageManager`) | `pnpm@12.20.0+sha512.6ccc74997ccef4e67999788e18dbfbfa583e2a849668668db4707b6a8306662f47156e650232a985bd3ec24cf9364c1aa154d37e51ed7aac62c1cd1e3afc80c3` | 2026-11-12 | `npm view pnpm` | 2026-11-20 |
| TypeScript | 7.0.2 | 2026-07-08 | `npm view typescript` | 2026-11-20 |
| Lit | 3.3.3 | 2026-05-14 | `npm view lit` | 2026-11-20 |
| Bundler candidate: Vite | 8.3.8 | 2026-11-11 | `npm view vite` | 2026-11-20 |
| Bundler candidate: Rollup | 4.68.3 | 2026-11-13 | `npm view rollup` | 2026-11-20 |
| Vitest | 5.1.0 | 2026-11-02 | `npm view vitest` | 2026-11-20 |
| `@vitest/coverage-v8` | 5.1.0 | 2026-11-02 | `npm view @vitest/coverage-v8` | 2026-11-20 |
| DOM environment candidate: happy-dom | 21.0.4 | 2026-10-20 | `npm view happy-dom` | 2026-11-20 |
| DOM environment candidate: jsdom | 31.0.1 | 2026-11-13 | `npm view jsdom` | 2026-11-20 |
| Biome | 2.6.7 | 2026-11-11 | `npm view @biomejs/biome` | 2026-11-20 |

The bundler and the DOM environment are chosen in the bootstrap issue (ADR 0001); only the chosen ones are pinned.

### GitHub Actions

| Action | Version | Commit SHA | Released | Checked |
|---|---|---|---|---|
| `actions/checkout` | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` | 2026-07-20 | 2026-11-20 |
| `actions/setup-node` | v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` | 2026-10-08 | 2026-11-20 |
| `pnpm/action-setup` | v6.1.1 | `73e46992e05b19abd31f2f3c20e0e7370d762115` | 2026-11-03 | 2026-11-20 |
| `actions/upload-artifact` | v7.0.2 | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` | 2026-10-07 | 2026-11-20 |
| `softprops/action-gh-release` | v3.0.4 | `8a0cd651e5b2365bd640854a3fa5dfc70e4875f3` | 2026-11-05 | 2026-11-20 |

### Held back (supply-chain cooldown, 2026-11-20)

| Package | Newest | Released | Adopted instead |
|---|---|---|---|
| pnpm | 12.21.0 (`latest`), 12.22.0 | 2026-11-13, 2026-11-17 | 12.20.0 |
| Rollup | 4.68.7 | 2026-11-18 | 4.68.3 |
| Vitest, `@vitest/coverage-v8` | 5.1.1 | 2026-11-18 | 5.1.0 |
| Biome | 2.6.8 | 2026-11-15 | 2.6.7 |

### Maintenance notes

- Lit 3.3.3 is the latest release, published 2026-05-14: just over six months ago. Lit is the stack decision (ADR 0001); re-check at the next `/check-versions`.
- `@rollup/plugin-node-resolve` (16.0.3, 2025-10-13) has had no release in over a year. It weighs against Rollup if the bundler needs it.

## Home Assistant support

- Minimum Home Assistant version: à vérifier (depends on the floor registry and vacuum area cleaning, see `docs/research/ha-core-vacuum.md`).
- Latest stable at the last check: Home Assistant 2026.11.2 (released 2026-11-16), frontend 20261028.6 (released 2026-11-13); checked 2026-11-20 with `gh api repos/home-assistant/{core,frontend}/releases/latest`.
- Tested on: stable and the current beta, recorded in each release.

## Supply chain

- A release younger than 7 days is noted, not adopted, unless it is a security fix.
- Actions pinned by full commit SHA with the version in a comment.
- Lockfile committed; `pnpm install --frozen-lockfile` in CI.

## Formats

- Conventional Commits 1.0.0, Semantic Versioning 2.0.0.
- Dates in ISO 8601.
