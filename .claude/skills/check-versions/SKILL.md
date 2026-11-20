---
name: check-versions
description: Verify the latest stable versions of Node.js, pnpm, npm packages and GitHub Actions (resolved to commit SHAs) at their official sources, then update docs/standards.md and the pins. Use for "/check-versions", "est-ce qu'on est à jour", before pinning anything new, before a release, or whenever a version is about to be written from memory.
---

# check-versions

A version is never written from memory. Sources, queried now:

| What | Command |
|---|---|
| Node.js LTS | `curl -s https://nodejs.org/dist/index.json` (first entry with `lts` set) |
| npm package | `npm view <pkg> version` and `npm view <pkg> time --json` (release date) |
| pnpm `packageManager` hash | `npm view pnpm@<version> dist.integrity` (`sha512-<base64>`), to hex: `node -p "Buffer.from(process.argv[1].slice(7), 'base64').toString('hex')" "<integrity>"` |
| GitHub Action | `gh api repos/<owner>/<repo>/releases/latest --jq .tag_name`, then `gh api repos/<owner>/<repo>/git/ref/tags/<tag> --jq '.object.type+" "+.object.sha'` (if `tag`, dereference with `git/tags/<sha>` until `commit`) |
| Home Assistant releases | `gh api repos/home-assistant/core/releases/latest --jq '.tag_name+" "+.published_at'` and the frontend repository for card APIs |
| Integrations covered by an adapter | `gh api repos/<owner>/<repo>/releases/latest --jq '.tag_name+" "+.published_at'`; a new release triggers `integration-scout` on `docs/research/<integration>.md` |

Steps:

1. List every pin: `package.json` (`engines`, `packageManager`, dependencies), `.github/workflows/*.yml`, `docs/standards.md`, the minimum Home Assistant version in the READMEs and Marketplace metadata.
2. Query the latest stable: the `latest` dist-tag on npm, the latest GitHub release for actions (no pre-release, no `next`/`beta`/`rc`). Adopt it with no waiting period (owner decision, 2026-11-20, `docs/standards.md` « Supply chain »).
3. Major bump: read the release notes and migration guide first; it is its own PR (`build(deps)!:` with the migration).
4. Update `docs/standards.md` « Versions vérifiées » with today's date, then the pins, in a `build(deps):` or `docs:` PR.
5. Report: changed, held back (and why), not verified.
