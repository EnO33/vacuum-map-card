---
name: work-issue
description: Take a vacuum-map-card issue from reading to a reviewed, green pull request — read it, branch, build test-first, run the checks, review (code, security, UX), live-test UI changes, open the PR, get CI green. Use for "/work-issue 12", "travaille sur l'issue 12", "prends l'issue #12".
argument-hint: "<issue number>"
---

# work-issue

Issue: `$ARGUMENTS`. No number given: run `next-issue` first and use the issue it picks.

## 1. Understand

1. `gh issue view <n> --json number,title,body,labels,state,comments`. Stop and say why if it is closed, `owner-only`, not `status:ready`, blocked by an open issue, or already has an open PR (`gh pr list --state open --search "<n> in:body"`).
2. Read `CLAUDE.md`, the ADRs and `docs/research/` documents the issue cites, and only the files it touches. Delegate a wide search to Explore.
3. A fact the issue relies on is « à vérifier » (service field, attribute, registry command): stop and propose an `integration-scout` run instead of guessing.
4. An owner decision is needed (public wording, option name, new dependency, breaking change): ask one question before writing code.

## 2. Plan

- Branch from an up-to-date `main`: `git switch main && git pull --ff-only && git switch -c <type>/<n>-<slug>`.
- Turn the acceptance criteria into a short task list. Search `src/` for what already exists (geometry helpers, parsers, ports, Lit base elements, i18n keys) and extend it.

## 3. Build

- `tdd` skill, innermost layer first: `domain` → `app` → `adapters` → `ui`.
- User-visible strings in every `src/i18n/*.json`; user-visible behaviour in `README.md` and `README.fr.md`.
- Fixtures: anonymised captures with a sibling `.md` (source, integration version, date).

## 4. Verify

1. Checks, all green: `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`, `pnpm run build` (note the bundle size and its change).
2. Run the `simplify` skill on the diff and apply what removes duplication or dead code.
3. Reviews, in one message: `reviewer` + `security-auditor`, plus `ux-reviewer` when `src/ui/` or `src/i18n/` changed. Fix blocker and major findings, re-run the checks; at most two rounds, then report what is left.
4. UI change: run `/ha-live-test` (it needs the owner: card deployed to their Home Assistant, robots never started without asking). Attach light and dark screenshots of a **demo or anonymised** setup to the PR, never the owner's real floor plans.

## 5. Ship

1. Commit: conventional subject with scope, body says why, written to `.tmp/commit-msg-<k>.txt` and committed with `git commit -F`. No Claude or AI mention, no co-author line.
2. `git push -u origin <branch>`.
3. `gh pr create --base main --body-file .tmp/pr-<n>.md`, title = commit subject. Body: `## What`, `## Why`, `## Risk`, `## Validation` (checks run, bundle size, reviews and verdicts, live test or why not), `Closes #<n>`.
4. Follow CI once with `gh pr checks <pr> --watch`; fix failures on the same branch.
5. Do not merge. Report in five lines: PR link, CI state, verdicts, what is not verified, follow-ups proposed as issues.
