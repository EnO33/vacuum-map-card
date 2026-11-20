---
name: add-adapter
description: Add support for a new vacuum integration to vacuum-map-card — research its data model, capture anonymised fixtures, implement a RoomSource adapter test-first, document it in both READMEs. Use for "/add-adapter <integration>", "ajoute le support de Valetudo", "supporte Roborock".
argument-hint: "<integration domain or repository>"
---

# add-adapter

Integration: `$ARGUMENTS`.

## 1. Research gate

1. Start `integration-scout` on the integration at its latest release (pinned tag or commit). It writes `docs/research/<integration>.md`: entities and registry `platform`, floor plans per map, room outlines and their coordinate system, calibration to pixels, active map behaviour, link to Home Assistant areas, room-cleaning action (name, fields, target), robot capabilities and states, cloud dependencies, licence.
2. Stop if the integration exposes no room geometry and no area mapping: the card cannot do more than a room list for it. Say so and propose an upstream issue draft instead.
3. Owner decision (`owner-only`): is this integration in scope? Ask with the research summary before writing code.

## 2. Fixtures

- Captures come from a real installation: the owner's (with `/ha-live-test` tooling) or a contributor's issue. Anonymise them (room names, map ids, entity prefixes, coordinates, anything in `.claude/private-patterns.local.txt`), store under `test/fixtures/<integration>/` with a sibling `.md` (source, integration version, date, what was changed).

## 3. Adapter

- `src/adapters/<integration>/` implementing the `RoomSource` port (ADR 0002), detection by registry `platform`, defensive parsing returning typed « unsupported » results with a reason. Built with the `tdd` skill against the fixtures. No integration knowledge outside this folder.
- Starting a clean follows ADR 0003: `vacuum.clean_area` when the room is mapped to an area, else this adapter's action.

## 4. Document and ship

- Add the integration to the table in `README.md` and `README.fr.md` with what works (outlines, plans, start).
- Then `work-issue` steps 4 and 5 (checks, reviews, live test when a real installation is available, PR).
