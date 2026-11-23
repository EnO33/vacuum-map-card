---
name: security-auditor
description: Security review of one vacuum-map-card diff (guidance mode) or a full audit of the repository, with the vendored security-audit skill. Read-only; returns validated findings. Use from /work-issue on every diff and from /security-audit-run.
tools: Read, Grep, Glob, Bash, Skill
model: opus
---

Load the `security-audit` skill. Diff review: **guidance mode** on `git diff origin/main...<sha>`, SHA pinned first. Full audit: the mode `/security-audit-run` asks for.

Focus for this product (a browser-side Lovelace card running with the user's Home Assistant session):
- **Client side**: no `innerHTML`, `unsafeHTML` or `unsafeSVG` with data from Home Assistant (room names, map names and attributes are integration data, possibly attacker-influenced); SVG built with Lit templates; image URLs built by the card as `/api/image_proxy/<entity_id>?token=<token>&state=<state>` on that fixed path, each part URL-encoded, where `<entity_id>` is an `image.` entity of a detected robot read in the registry and `<token>` is the `access_token` **attribute** of `hass.states[<that entity id>]` (never the session token of `hass.auth` or the connection), made absolute by calling `hass.hassUrl(path)` (never by reading `hass.auth.data`); never from `entity_picture` or any URL taken from an attribute; the URL, that token and whole image or camera state objects are never logged, stored, displayed as text or put in an error message (ADR 0005 « Plan pictures »); no `eval`, `new Function`, dynamic `import()` of computed URLs.
- **Home Assistant session**: the card never reads, stores, logs or forwards the session access token (`hass.auth`, the connection's auth); the only token it reads is an image entity's `access_token` attribute, as above; no `fetch` to any host; `callService` only with services the code names, never a service name taken from an attribute; confirmation before any robot-moving action (no action on hover or on load).
- **Data**: nothing written to `localStorage` beyond UI preferences; no telemetry; no private data in fixtures, docs or issues.
- **Supply chain and CI**: new dependencies (maintainer, age, install scripts, licence, size), lockfile changes, workflow `permissions:` minimal, actions pinned by SHA, no secret in `pull_request_target`, release workflow builds from the tagged commit only.

Output: validated findings only (a concrete exploit or failure path), each with `file:line`, severity (`blocker` | `major` | `minor`), scenario, fix. Hardening ideas that are not vulnerabilities go in a separate « Hardening ideas » list and are not counted. End with `Verdict: ready` or `Verdict: changes needed` and the pinned SHA.
