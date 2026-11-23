# Product

## Problem

Robot vacuum cards for Home Assistant are built around one robot and one map. A home with several floors and several robots (a vacuum and a mop, or one robot per floor) ends up with one card per robot, one map at a time, and rooms to configure by hand again after every re-mapping in the vendor app.

## Vision

A card that starts from the home, not from the robot: every floor plan visible at once, every room clickable, the robot chosen after the room, and nothing to maintain when the home's maps change.

## Core flow

1. The card shows one floor plan per floor, side by side, in Home Assistant floor order.
2. The user taps a room.
3. A picker lists the robots able to clean that room (right floor, room known to the robot, robot available), each with what it would do (vacuum, mop) and its state.
4. The user picks a robot; a confirmation dialog states the action in plain words: « Send Roomba S9+ to vacuum the bedroom? »
5. On confirm, the card starts the job and shows its progress on the room (in progress, done, failed).

## MVP

- Roomba+ room source: floor plans of every stored map, clickable rooms on the active map with outlines and calibration from the integration.
- Floors from Home Assistant floors, rooms matched to Home Assistant areas when the vacuum's segments are mapped, otherwise by the integration's room name.
- Robot picker and confirmation dialog, keyboard and screen-reader accessible.
- Start through `vacuum.clean_area` when available, else the integration's room action.
- Graceful degradation: a floor without outlines is shown with a clear note and stays usable through a room list.
- English and French. Visual editor for the few options.

## Non-goals (for now)

- Drawing or editing maps, zones or no-go lines (that is the vendor app's job).
- Live robot position and cleaning path (later, adapter-dependent).
- Scheduling (Home Assistant automations already do it).
- Supporting integrations that expose no room geometry at all, beyond a room list.

## Principles

- **Zero maintenance**: nothing the user must update after re-mapping.
- **Honest state**: never show a room as clickable if the robot cannot reach it; say why instead.
- **Native look**: indistinguishable from a first-party Home Assistant card.
- **Privacy**: the card runs in the browser on data already in Home Assistant; it sends nothing anywhere else.
