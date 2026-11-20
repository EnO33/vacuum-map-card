# ADR 0002: Room sources, one adapter per integration

- Status: accepted
- Date: 2026-11-20

## Context

Room geometry is not standardised in Home Assistant. Each vacuum integration exposes it differently, or not at all: as image entity attributes, camera attributes, service responses or nothing. Integration data models also change between releases. The card must adapt by itself to re-mapping, new rooms and new floors.

## Decision

- The `app` layer defines a `RoomSource` port. For one robot it returns, per stored map: the floor plan image entity, the map name, the rooms (id, name, outline in image pixels or with a calibration to convert them), whether the map is the robot's active one, and how to start a room.
- Each integration gets one adapter in `src/adapters/<integration>/` that implements `RoomSource` from Home Assistant state only (no network). Detection is automatic from the entity registry (`platform`), never from entity id patterns written by hand.
- Adapters parse every attribute defensively; an unknown shape returns a typed « unsupported » result with the reason, never a throw.
- The first adapter is Roomba+; its data model is documented in `docs/research/roomba-plus.md`.
- Floors and room-to-area links come from Home Assistant registries (floors, areas, vacuum segment mapping), not from adapters, so they work the same for every integration.

## Consequences

- A new integration is one folder plus one research document (`/add-adapter`).
- When an integration only exposes geometry for its active map (Roomba+ today), other floors show their plan with a room list instead of clickable outlines, and say why.
