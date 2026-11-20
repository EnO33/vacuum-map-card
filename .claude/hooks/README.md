# Project hooks

Guardrails wired in `.claude/settings.json`. Node.js standard library only. Both guards fail closed (`onFailure: block`). Tests: `node --test scripts/test-hooks.mjs`.

| File | Event | Effect |
|---|---|---|
| `guard-bash.mjs` | PreToolUse Bash | Blocks owner-only commands (`gh pr merge`, repository, release, secret and ruleset changes, publishing, pushing or creating tags, deleting remote branches), push to `main`, force push, history rewrites, `npm install` (pnpm only), piping a download into a shell, `.env` access, environment dumps, protected `git config` keys, `rm -rf` outside build outputs, shell edits of the guardrails |
| `guard-files.mjs` | PreToolUse Read/Edit/Write | Blocks secrets (`.env*` except `.env.example`, `*.pem`, `*.key`); writes to `.claude/settings.json`, `.claude/hooks/`, `scripts/test-hooks*`, `.git/`, `pnpm-lock.yaml`, `CHANGELOG.md`; AI attribution in any written content; the owner's private data (`.claude/private-patterns.local.txt`) in any tracked file |
| `format-on-write.mjs` | PostToolUse Edit/Write | Runs the project's Biome formatter on the file (no-op until Biome is installed) |
| `session-start.mjs` | SessionStart | Branch, uncommitted files, ready issues, open PRs, missing local files |
| `rules.mjs` | | The pure rules, shared by the guards and the tests |
| `lib.mjs` | | Payload, block, owner mode, bounded process runner, private patterns |

## Owner mode

The owner lifts the owner-only rules (merge, release, tags, repository settings, guardrail edits) by starting Claude Code with `VMC_OWNER_MODE=1`, which an agent cannot set. A subagent never inherits it: any `agent_type` field in the hook input turns it off. Safety rules (force push, push to `main`, secrets, `rm -rf`, AI attribution, private data) stay on in owner mode.

## Private data

`.claude/private-patterns.local.txt` (Git-ignored) lists literal strings that identify the owner's home: IP address, entity ids, dashboard and stack names. A write that would put one of them in a tracked file is blocked; `CLAUDE.local.md`, `.tmp/` and the local settings are exempt. Missing file: the rule is inactive and the session start says so.

## Limits

The Bash rules read the command text: they catch mistakes and the usual forms, not a determined bypass (variables, encoded strings, scripts that run git themselves). `PowerShell` and `Monitor` are denied in `settings.json` because these hooks only judge the `Bash` tool. Branch protection on GitHub (owner-only) is the real barrier for `main`.
