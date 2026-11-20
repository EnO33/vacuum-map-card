# Standards

Binding. Every version here is checked live by `/check-versions` and dated. A row without a date is « à vérifier » and must not be used.

## Versions vérifiées

| Tool | Version | Released | Source | Checked |
|---|---|---|---|---|
| Node.js (LTS « Lithium », tooling only) | 26.13.1 | 2026-11-10 | nodejs.org/dist/index.json | 2026-11-20 |
| pnpm (`packageManager`, `latest` dist-tag) | `pnpm@12.21.0+sha512.66fd8278ee28935ce951792d34367ff3af5c432a2756445823029533835b8da529bbe0be5130afd56ed0713fb8789e47bad82d93bd5ae2fe54b15562d6276ef0` | 2026-11-13 | `npm view pnpm` | 2026-11-20 |
| TypeScript | 7.0.2 | 2026-07-08 | `npm view typescript` | 2026-11-20 |
| Lit | 3.3.3 | 2026-05-14 | `npm view lit` | 2026-11-20 |
| Bundler: Vite (Rolldown via `~1.2.18`, resolved to 1.2.19 of 2026-11-11 on 2026-11-20; the lockfile pins it) | 8.3.8 | 2026-11-11 | `npm view vite`, `npm view vite@8.3.8 dependencies.rolldown` | 2026-11-20 |
| Vitest | 5.1.1 | 2026-11-18 | `npm view vitest` | 2026-11-20 |
| `@vitest/coverage-v8` | 5.1.1 | 2026-11-18 | `npm view @vitest/coverage-v8` | 2026-11-20 |
| DOM environment: happy-dom | 21.0.4 | 2026-10-20 | `npm view happy-dom` | 2026-11-20 |
| Biome | 2.6.8 | 2026-11-15 | `npm view @biomejs/biome` | 2026-11-20 |

Bundler and DOM environment chosen in ADR 0001 (measurements there). No bundler plugin is needed.

### GitHub Actions

Releases are created with the `gh` CLI preinstalled on GitHub-hosted runners, not with a third-party action.

| Action | Version | Commit SHA | Released | Checked |
|---|---|---|---|---|
| `actions/checkout` | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` | 2026-07-20 | 2026-11-20 |
| `actions/setup-node` | v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` | 2026-10-08 | 2026-11-20 |
| `pnpm/action-setup` | v6.1.1 | `73e46992e05b19abd31f2f3c20e0e7370d762115` | 2026-11-03 | 2026-11-20 |
| `actions/upload-artifact` | v7.0.2 | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` | 2026-10-07 | 2026-11-20 |
| `actions/download-artifact` | v8.0.2 | `9000827ccba6bdab643e8b6fd33ac0654aef8333` | 2026-10-07 | 2026-11-20 |

### Maintenance notes

- Lit 3.3.3 is the latest release, published 2026-05-14: just over six months ago. Lit is the stack decision (ADR 0001); re-check at the next `/check-versions`.

## Home Assistant support

- Minimum Home Assistant version: à vérifier (depends on the floor registry and vacuum area cleaning, see `docs/research/ha-core-vacuum.md`).
- Latest stable at the last check: Home Assistant 2026.11.2 (released 2026-11-16), frontend 20261028.6 (released 2026-11-13); checked 2026-11-20 with `gh api repos/home-assistant/{core,frontend}/releases/latest`.
- Tested on: stable and the current beta, recorded in each release.

## Supply chain

- Owner decision (2026-11-20): the project uses the latest stable release of every tool, as published under the package's `latest` dist-tag (or the project's latest GitHub release), with no waiting period. Pre-releases and other dist-tags (`next`, `beta`, `rc`) are not adopted.
- Dependency build scripts stay blocked unless approved (pnpm's default).
- Actions pinned by full commit SHA with the version in a comment.
- Lockfile committed; `pnpm install --frozen-lockfile` in CI.

## Formats

- Conventional Commits 1.0.0, Semantic Versioning 2.0.0.
- Dates in ISO 8601.
