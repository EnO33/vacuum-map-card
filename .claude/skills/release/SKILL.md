---
name: release
description: Cut a vacuum-map-card release — pick the version, open the bump PR, prepare the tag, check the GitHub release and its asset, draft the issue replies and the community posts for the owner. Use for "/release", "fais une release", "sors la 0.2.0".
argument-hint: "[X.Y.Z]"
disable-model-invocation: true
---

# release

Version: `$ARGUMENTS`; empty: derive it. Publishing is the owner's: this skill prepares, the owner merges, tags and posts.

1. What ships: `git log v<last>..origin/main --format='%s'` (last tag: `git describe --tags --abbrev=0 origin/main`; none yet: first release). Only `build(deps)` and `ci` commits: say a release is not needed and stop unless the owner insists.
2. Version (`CONTRIBUTING.md`): patch for fixes, docs, internal refactors; minor for a feature, option or adapter; major for a breaking change for users. Confirm the number with the owner.
3. Pre-flight: `/check-versions` (Home Assistant stable and beta known), `/ha-live-test` on stable (and beta when available), `ux-reviewer` on the whole card, `security-auditor` guidance on the diff since the last tag.
4. Bump PR: branch `chore/release-X.Y.Z`, set `version` in `package.json` (and the version banner if it is not derived from it), minimum Home Assistant in both READMEs and Marketplace metadata if it changed. Commit `chore: bump version to X.Y.Z`. PR body: `Version bump for the X.Y.Z release.`, then `Since vA.B.C:` and one bullet per PR. Wait for CI green; the owner merges.
5. Tag (owner): give the owner the exact commands for an up-to-date `main`: `git tag -a vX.Y.Z -m "vX.Y.Z: <short summary>"` and `git push origin vX.Y.Z`. The hooks block agents from tagging.
6. Check: the release workflow run (`gh run list --workflow release.yml --limit 1`) and `gh release view vX.Y.Z` (asset `vacuum-map-card.js` attached, notes generated from the commits). Notes: ASCII only, no emojis, no Claude or AI mention.
7. Drafts for the owner (never post them):
   - one reply per issue the release fixes, in the reporter's language, asking them to update and confirm;
   - first release only: the Marketplace / custom repository submission text and a community forum post (English, and French for HACF.fr), short, ASCII only, no em-dashes, no emojis, nothing that reads machine-written.
