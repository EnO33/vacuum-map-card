# Standards

Binding. Every version here is checked live by `/check-versions` and dated. A row without a date is « à vérifier » and must not be used.

## Versions vérifiées

| Tool | Version | Source | Checked |
|---|---|---|---|
| Node.js (LTS, tooling only) | à vérifier | nodejs.org/dist/index.json | |
| pnpm (`packageManager` with hash) | à vérifier | `npm view pnpm` | |
| TypeScript | à vérifier | `npm view typescript` | |
| Lit | à vérifier | `npm view lit` | |
| Bundler (Rollup or Vite) | à vérifier | `npm view <pkg>` | |
| Vitest | à vérifier | `npm view vitest` | |
| DOM environment (happy-dom or jsdom) | à vérifier | `npm view <pkg>` | |
| Biome | à vérifier | `npm view @biomejs/biome` | |
| GitHub Actions (pinned by SHA) | à vérifier | `gh api repos/<owner>/<repo>/releases/latest` | |

## Home Assistant support

- Minimum Home Assistant version: à vérifier (depends on the floor registry and vacuum area cleaning, see `docs/research/ha-core-vacuum.md`).
- Tested on: stable and the current beta, recorded in each release.

## Supply chain

- A release younger than 7 days is noted, not adopted, unless it is a security fix.
- Actions pinned by full commit SHA with the version in a comment.
- Lockfile committed; `pnpm install --frozen-lockfile` in CI.

## Formats

- Conventional Commits 1.0.0, Semantic Versioning 2.0.0.
- Dates in ISO 8601.
