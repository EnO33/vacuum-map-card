---
name: plan-epic
description: Turn an idea, a backlog item or an oversized issue into an epic and agent-ready issues for vacuum-map-card, through the planner agent, with owner approval before anything is created. Use for "/plan-epic", "découpe cette idée", "prépare le backlog de…", or when next-issue finds a size:L issue.
argument-hint: "<idea, backlog item, or #n to split>"
---

# plan-epic

Input: `$ARGUMENTS`.

1. If the idea depends on facts not yet in `docs/research/` (a Home Assistant API, an integration's attributes or actions), start `integration-scout` first, or plan its research as the first issue.
2. Start the `planner` agent with the input (and the scout's report when there is one).
3. **Show the plan to the owner and wait for a yes.** Owner questions (`owner-only`) are asked here, one line each.
4. On approval: create the epic, then the issues, link them as sub-issues and set « Blocked by » links. Label `status:ready` only the issues with nothing « à vérifier ».
5. Update `docs/backlog.md` (the item now points to its epic) in a `docs:` PR, and report the created issue links in delivery order.
