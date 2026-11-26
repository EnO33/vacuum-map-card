---
name: ha-live-test
description: Deploy the built card to the owner's Home Assistant and check it in a real browser — resource loaded, card renders on a test dashboard, interactions work, light and dark themes, no console error. Use for "/ha-live-test", "teste sur le Home Assistant", before merging any UI change and before a release.
disable-model-invocation: true
---

# ha-live-test

Local details (URL, Pi host, config mount, test dashboard, robots): `CLAUDE.local.md`. Never copy them into a tracked file, a PR or a screenshot that will be published.

## 1. Build

`pnpm run build`; note the bundle size and the version string the card logs on load.

## 2. Deploy (needs the owner)

1. Connect to the Pi with the owner's SSH key, held by the Windows ssh-agent: use Windows OpenSSH (`C:\Windows\System32\OpenSSH\ssh.exe` and `scp.exe`, with `-o BatchMode=yes`), not Git Bash `ssh`. Host in `CLAUDE.local.md`. Never ask for a password.
2. Write a helper script in the scratchpad directory, never in the repo. It finds the `/config` mount (`docker inspect homeassistant`), uploads `dist/vacuum-map-card.js` by SFTP to a temporary path, copies it with `sudo` to `<config>/www/vacuum-map-card/vacuum-map-card.js`, and prints its size and SHA-256.
3. Delete the helper script, even on failure.
4. Dashboard resource: `/local/vacuum-map-card/vacuum-map-card.js?v=<build hash>` (module). Create or update it through the Home Assistant UI or the `lovelace/resources/*` websocket commands in the browser, with the owner's agreement; never touch other resources.

## 3. Check in the browser (Claude in Chrome, owner signed in)

1. Open the test dashboard from `CLAUDE.local.md` in a new tab, hard reload. The console shows the card's version banner and no error from the card (`read_console_messages` with a pattern on the card name).
2. Render: every floor plan side by side, labels readable, degraded states where expected (plan disabled, floor without outlines).
3. Interaction: hover and focus on a room; keyboard (Tab, arrows, Enter, Escape); open the robot picker; open the confirmation. **Cancel it.** Never confirm a clean unless the owner says so for this run: robots and the owner's automations are real.
4. Themes: switch the user theme light and dark (or the browser colour scheme) and check contrast and colours.
5. Widths: wide desktop, tablet (~800 px) and phone (~400 px).
6. Screenshots for the PR only from a demo or anonymised setup; the owner's real plans stay local.

## 4. Report

Pass or fail per step, console errors (card ones only), bundle size, Home Assistant version, and what was not checked. Add it to the PR's `## Validation`.
