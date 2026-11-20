# Claude Code agents and skills for vacuum-map-card

Available in every Claude Code session opened in this repository. Adapted from the owner's other projects (`meteo-consensus` factory, `eaux-marseille-ha`).

## Agents (`.claude/agents/`)

| Agent | Model | Writes | Role |
|---|---|---|---|
| `planner` | opus | issue bodies | Idea → epic → agent-ready issues, one PR each, in delivery order |
| `integration-scout` | opus | `docs/research/`, anonymised fixtures | Verifies how Home Assistant and vacuum integrations expose floors, maps, rooms, calibration and actions |
| `reviewer` | opus | nothing | Correctness, Home Assistant hygiene, architecture, types, tests, simplicity |
| `security-auditor` | opus | nothing | Diff review (guidance mode) or full audit with `security-audit` |
| `ux-reviewer` | opus | nothing | Native look, no « AI slop », accessibility, light/dark, phone to tablet (ADR 0004) |

Implementation is done by the main session (`/work-issue`); reviewers are read-only on purpose: the one who writes never grades their own work.

## Skills (`.claude/skills/`)

| Skill | Invocation | What it does |
|---|---|---|
| `work-issue` | `/work-issue <n>` | Issue → branch → TDD → checks → `simplify` → reviews → live test for UI → PR → CI green. Never merges |
| `next-issue` | `/next-issue` | Next ready issue (bugs first), blocked and owner-only listed apart, then `work-issue` |
| `plan-epic` | `/plan-epic <idea>` | `integration-scout` if needed → `planner` → owner yes → issues and links |
| `tdd` | `/tdd <behaviour>` | Red, green, refactor with Vitest, innermost layer first |
| `add-adapter` | `/add-adapter <integration>` | Research gate, anonymised fixtures, `RoomSource` adapter, READMEs |
| `ha-live-test` | `/ha-live-test` | Deploys the build to the owner's Home Assistant and checks it in Chrome (never confirms a clean without the owner) |
| `check-versions` | `/check-versions` | Live versions and SHAs, `docs/standards.md` |
| `release` | `/release [X.Y.Z]` | Bump PR, tag commands for the owner, release check, drafts of replies and posts |
| `security-audit-run` | `/security-audit-run [quick\|standard]` | Full audit, confirmed findings filed as issues |
| `security-audit` | vendored | Used by `security-auditor` |
| `caveman` | vendored | Terse chat replies |

## Guardrails

See `.claude/hooks/README.md`: owner-only commands, push to `main`, force push, tags, secrets, guardrail edits, AI attribution and the owner's private data in tracked files are blocked. Tests: `node --test scripts/test-hooks.mjs`.

## Vendored skills

Copied as-is from `eaux-marseille-ha` (same commits as there). Update by copying the upstream files again and noting the commit here.

| Skill | Source | Commit | Licence |
|---|---|---|---|
| `security-audit` | [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill), `skills/security-audit/` | `c1c8a8c` (2026-09-14) | MIT (`security-audit/LICENSE`) |
| `caveman` | [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman), `skills/caveman/SKILL.md` | `9b68f7e` (2026-10-25) | Apache-2.0 (`caveman/LICENSE`) |

Only caveman's core skill is vendored: its hooks, statusline and `caveman-compress` are left out on purpose.
