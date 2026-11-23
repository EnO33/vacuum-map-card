# Backlog

Ideas to turn into issues with `/plan-epic`. Order is the intended delivery order. Nothing here is agent-ready until it is an issue with `status:ready`.

## Epic 1: Bootstrap (owner-only decisions first)

Planned as epic #2 (issues #3 to #11). The list below is the original idea; the epic is the source of truth.

- Owner decisions: final name (check it is free in the Marketplace), GitHub repository creation and settings. Licence decided: MIT (2026-11-20).
- `/check-versions` fills `docs/standards.md`; scaffold `package.json`, TypeScript strict config, Biome, Vitest, bundler, `src/index.ts` registering an empty card that renders « Vacuum Map Card » in an `ha-card`.
- CI workflow: install, lint, typecheck, test with coverage, build with size report; actions pinned by SHA.
- Release workflow: tag `vX.Y.Z` builds `dist/` and attaches it to the GitHub release; `hacs.json` / Marketplace metadata « à vérifier ».

## Epic 2: Verify the Home Assistant data model

Planned as epic #22 (issues #23 to #29). The list below is the original idea; the epic is the source of truth.

- `integration-scout`: verify `docs/research/ha-core-vacuum.md` (floors, areas, segment mapping, `vacuum.clean_area`) at the pinned Home Assistant version; capture anonymised registry shapes.
- `integration-scout`: re-verify `docs/research/roomba-plus.md` against the Roomba+ source (`services.yaml`, image entity attributes), capture anonymised fixtures.

## Epic 3: Domain and app

- Geometry: polygon hit test, affine transform from calibration points, outline to SVG path, label placement (ADR 0002 « Parsing limits »).
- Floor model: floors from HA, plans per floor from room sources, rooms with outlines or list-only (ADR 0005 « Floors », « Map to floor », « Rooms map pairing », « Room lists »).
- Eligibility: robots that can clean a room (floor, room known, state, capability), with a reason when not (ADR 0005 « Room to area »; ADR 0003 « Eligibility (both paths) », « Path 1 », « Checks before calling »).
- Start use case: `vacuum.clean_area` when mapped, else the adapter's action; typed errors (ADR 0003 « Path 1 », « Path 2 », « Errors »).

## Epic 4: Roomba+ adapter

- Detect robots by registry platform, read `rooms_map`, `floor_plan_*` (enabled or not), `get_rooms`, map ids; parse defensively; fixtures.

## Epic 5: UI

- Card layout: floors side by side (responsive: stacked on narrow screens), plan images, SVG room layer with labels.
- Room interaction: hover/focus, keyboard navigation, robot picker (popover / bottom sheet), confirmation dialog, progress state.
- Degraded states: plan disabled (how to enable), no outlines on this floor (room list), robot unavailable.
- Visual editor, i18n English and French, light and dark screenshots.

## Epic 6: MVP release

- README with real screenshots of a demo home (not the owner's), docs, `/ha-live-test` on stable and beta, owner publishes the release and the Marketplace submission.

## Later

- Live robot position and path (adapter-dependent), more adapters (Valetudo, Roborock, Dreame, Ecovacs: research first), room cleaning history overlay, multi-room selection.
- Upstream: draft an issue for Roomba+ asking for outlines and calibration on every stored map (owner posts it).
