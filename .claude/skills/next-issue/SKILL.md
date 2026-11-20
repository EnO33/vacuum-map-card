---
name: next-issue
description: Pick the next vacuum-map-card issue to work on — ready ones first, bugs before features, blocked and owner-only ones listed apart — then hand it to work-issue. Use for "/next-issue", "quelle est la prochaine issue", "prends la suite".
---

# next-issue

1. Open issues: `gh issue list --state open --json number,title,labels,updatedAt --limit 100`.
2. Ready set: `status:ready`, not `owner-only`, no open PR (`gh pr list --state open --search "<n> in:body"`), every « Blocked by #N » closed (read the body).
3. Order: `type:bug` first, then the backlog order (epic order in `docs/backlog.md`, lowest number first), smallest `size` first among equals.
4. Report in a few lines: the next issue (number, title, labels), the two that would follow, the `owner-only` ones with their question, the blocked ones with their blocker, the ones not ready and what they miss.
5. Unless the request was only to look, continue with `work-issue` on it.

No issue ready: say so, list what blocks the backlog, and suggest `/plan-epic` on the next item of `docs/backlog.md`.
