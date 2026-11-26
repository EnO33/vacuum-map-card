# Standards

Binding. Every version here is checked live by `/check-versions` and dated. A row without a date is « à vérifier » and must not be used.

## Versions vérifiées

| Tool | Version | Released | Source | Checked |
|---|---|---|---|---|
| Node.js (LTS « Lithium », tooling only) | 26.13.1 | 2026-11-10 | nodejs.org/dist/index.json | 2026-11-26 |
| pnpm (`packageManager`, `latest` dist-tag) | `pnpm@12.23.0+sha512.02da94ffaf133f46074322afe552f90d40b5f71ae259aefbccdacc5085b1d617e98d65e0131f5748b9b67445978ee5055d7d59a473f1eef0d504854fefcd5975` | 2026-11-22 | `npm view pnpm` | 2026-11-26 |
| TypeScript | 7.0.2 | 2026-07-08 | `npm view typescript` | 2026-11-26 |
| Lit | 3.3.3 | 2026-05-14 | `npm view lit` | 2026-11-26 |
| Bundler: Vite (Rolldown via `~1.3.2`, resolved to 1.3.4 of 2026-11-26 on 2026-11-26; the lockfile pins it) | 8.4.0 | 2026-11-26 | `npm view vite`, `npm view vite@8.4.0 dependencies.rolldown` | 2026-11-26 |
| Vitest | 5.1.2 | 2026-11-25 | `npm view vitest` | 2026-11-26 |
| `@vitest/coverage-v8` | 5.1.2 | 2026-11-25 | `npm view @vitest/coverage-v8` | 2026-11-26 |
| DOM environment: happy-dom | 21.0.4 | 2026-10-20 | `npm view happy-dom` | 2026-11-26 |
| Biome | 2.6.9 | 2026-11-24 | `npm view @biomejs/biome` | 2026-11-26 |

Bundler and DOM environment chosen in ADR 0001 (measurements there). No bundler plugin is needed.

### GitHub Actions

Releases are created with the `gh` CLI preinstalled on GitHub-hosted runners, not with a third-party action.

| Action | Version | Commit SHA | Released | Checked |
|---|---|---|---|---|
| `actions/checkout` | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` | 2026-07-20 | 2026-11-26 |
| `actions/setup-node` | v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` | 2026-10-08 | 2026-11-26 |
| `pnpm/action-setup` | v6.1.1 | `73e46992e05b19abd31f2f3c20e0e7370d762115` | 2026-11-03 | 2026-11-26 |
| `actions/upload-artifact` | v7.0.2 | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` | 2026-10-07 | 2026-11-26 |
| `actions/download-artifact` | v8.0.2 | `9000827ccba6bdab643e8b6fd33ac0654aef8333` | 2026-10-07 | 2026-11-26 |
| `hacs/action` | `main` (no release since 22.5.0 of 2022-05-28; runs the image `ghcr.io/hacs/action:main` whatever the pin) | `1ebf01c408f29afcb6406bd431bc98fd8cbb15aa` | 2026-06-08 (commit) | 2026-11-26 |

### Maintenance notes

- Lit 3.3.3 is still the latest release on 2026-11-26 (`npm view lit dist-tags`: `latest` 3.3.3), published 2026-05-14, six months and twelve days ago. The project is active: the last commit on `lit/lit` `main` is of 2026-11-05 (`gh api repos/lit/lit/commits/main`). Lit is the stack decision (ADR 0001); nothing to change, re-check at the next `/check-versions`.
- Vite 8.4.0 adds a Windows-only optional dependency, `napi-windows-process-start-time` 0.1.0 (MIT, by a Vite maintainer, about 13 kB unpacked, no install script; `npm view napi-windows-process-start-time@0.1.0`). It ships prebuilt native `.node` binaries for win32 x64 and arm64 (npm provenance: tag `v0.1.0` of `sapphi-red/napi-windows-process-start-time`), which Vite's CLI loads on Windows development machines only. It is a development tool dependency: never installed in CI (Linux) and never in the bundle.

## Home Assistant support

- Minimum Home Assistant version: **2026.3.0** (owner decision, 2026-11-23, #28). Declared in `hacs.json` (`homeassistant`). Reasons:
  - `vacuum.clean_area` and `CLEAN_AREA`, path 1 of ADR 0003, first ship in 2026.3.0 ([`ha-core-vacuum.md`, « First versions »](research/ha-core-vacuum.md#first-versions)). This is the binding constraint.
  - The registry read paths need less: area `floor_id` since 2024.4.0, `hass.floors` since 2024.10.0 ([`ha-core-registries.md`, « First versions »](research/ha-core-registries.md#first-versions)).
  - Roomba+ 4.6.5 declares 2025.5.0 ([`roomba-plus.md`, « Versions covered »](research/roomba-plus.md#versions-covered)).
  - On 2026.3.x and 2026.4.x an area without mapped segments makes `clean_area` succeed without cleaning (`areas_not_mapped` arrives in 2026.5.0, [`ha-core-vacuum.md`, « First versions »](research/ha-core-vacuum.md#first-versions)); the card must check the mapping before calling (a requirement for the clean use case of Epic 3), so this is a behaviour to handle, not a reason for a higher minimum.
  - Installing from the Marketplace needs Home Assistant 2026.11 ([`marketplace.md`, « Owner decisions (2026-11-20) »](research/marketplace.md#owner-decisions-2026-11-20)); a manual dashboard resource needs only the minimum above.
  - Raising the minimum later is a major version (`CONTRIBUTING.md`).
- Latest stable at the last check: Home Assistant 2026.11.3 (released 2026-11-23), frontend 20261028.8 (released 2026-11-20); checked 2026-11-26 with `gh api repos/home-assistant/{core,frontend}/releases`.
- Current beta at the last check: Home Assistant 2026.12.0b1 (released 2026-11-26), frontend 20261125.0 (released 2026-11-25); checked 2026-11-26 with `gh api repos/home-assistant/{core,frontend}/releases`. Each frontend version is the `home-assistant-frontend` requirement of `homeassistant/components/frontend/manifest.json` at the core tag (`gh api repos/home-assistant/core/contents/homeassistant/components/frontend/manifest.json?ref=<tag>`).
- Tested on: stable and the current beta, recorded in each release.

## Supply chain

- Owner decision (2026-11-20): the project uses the latest stable release of every tool, as published under the package's `latest` dist-tag (or the project's latest GitHub release), with no waiting period. Pre-releases and other dist-tags (`next`, `beta`, `rc`) are not adopted.
- pnpm's own waiting period is turned off to match: `minimumReleaseAge: 0` in `pnpm-workspace.yaml` (owner decision, 2026-11-26, #144). pnpm's documented default is 1440 minutes (seen in effect with pnpm 12.23.0, which held Rolldown 1.3.4 back on 2026-11-26), so without it a release of the day is held back or gets a per-version `minimumReleaseAgeExclude` entry ([pnpm settings, `minimumReleaseAge`](https://pnpm.io/settings/dependency-resolution#minimumreleaseage), read 2026-11-26).
- Dependency build scripts stay blocked unless approved (pnpm's default).
- Actions pinned by full commit SHA with the version in a comment.
- Lockfile committed; `pnpm install --frozen-lockfile` in CI.

## Formats

- Conventional Commits 1.0.0, Semantic Versioning 2.0.0.
- Dates in ISO 8601.
