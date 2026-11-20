---
name: security-audit-run
description: Run a full security audit of vacuum-map-card with the security-audit skill and file what it confirms as issues. Use for "/security-audit-run", "audit de sécurité complet", before a major release.
argument-hint: "[quick|standard]"
disable-model-invocation: true
---

# security-audit-run

Profile: `$ARGUMENTS`, `quick` when empty.

1. Load the `security-audit` skill in **full audit mode** with that profile. Target: this repository at the current `main` commit (clean working tree; say so if it is dirty). Companion domains: `CLIENT-SIDE.md` (DOM and SVG rendering of integration data, Lit templates, `unsafe*` directives), `WEB-PROTOCOL-AND-AUTH.md` (use of the Home Assistant session and websocket), `SUPPLY-CHAIN-AND-RELEASE.md` (npm dependencies, GitHub Actions, tag-triggered release, Marketplace metadata).
2. Output directory outside the repository: `~/security-audit-skill/vacuum-map-card/run-<N>` (the skill's default). Never write audit files inside the repo.
3. Scope to state to the auditors: a browser-side Lovelace card loaded by Home Assistant, running with the signed-in user's session; it reads entity states, registries and images from Home Assistant, renders integration-provided names and polygons as SVG, and calls vacuum actions after a confirmation; it makes no other network request and stores nothing beyond UI preferences.
4. Nothing target-controlled runs outside the sandbox the skill requires. Never call a robot action against a real Home Assistant during the audit: findings that need one stay `needs_validation`.
5. When the run ends, read `REPORT.md`. For each `confirmed` finding, open an issue (label `type:bug`, severity in the title, English, sections Finding / To do) unless one exists. List `needs_validation` items in one issue for the owner. A finding that could harm users (session misuse, script injection): tell the owner first and do not file it publicly; propose a GitHub security advisory instead.
6. Report: profile, coverage statement from the report, issues opened.
