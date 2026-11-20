# ADR 0003: Starting a clean

- Status: proposed
- Date: 2026-11-20

## Context

Home Assistant core added area-based cleaning for vacuums (`vacuum.clean_area`, with a mapping between vacuum segments and areas in the entity settings; « à vérifier »: exact service fields, minimum version and the entity feature flag). Integrations also keep their own room actions (Roomba+: `roomba_plus.clean_room` with a room name).

## Decision

1. If the robot's room is mapped to a Home Assistant area and the vacuum supports area cleaning, call `vacuum.clean_area` with that area.
2. Otherwise call the adapter's own room action.
3. Every start is confirmed by the user in a dialog that names the robot, the action (vacuum or mop) and the room.
4. The card never chains robots or adds conditions (pad state, water level): that belongs to the user's automations and scripts. An option may later let the user point a robot to a script instead of a direct action.

## Consequences

- The same card works for any integration that supports core area cleaning, even without a dedicated adapter, as long as some room geometry is available.
- Errors from the action are shown in the dialog in plain words, with the integration's message.
