# Home Assistant Marketplace: publishing a dashboard card

Status: **verified** on 2026-11-20 against Home Assistant **2026.11.2** (Marketplace integration `marketplace`, tag `2026.11.2` = commit `ff5d56b825a0fb66b03d01bc297d49e206cdaba3`) and its frontend **20261028.6** (tag = commit `92bcd97390e7f684df4bf3738aec812ff427d46e`). Re-check when `/check-versions` moves the latest Home Assistant release, and before tagging the first release.

Method: source read at the pinned tags with `gh api repos/<owner>/<repo>/contents/<path>?ref=<tag or sha>`; documentation read with a web fetch on 2026-11-20. No capture from a real installation was needed: nothing in this document comes from the owner's home.

## Where things live (2026-11-20)

| What | Where | Source |
|---|---|---|
| Marketplace code (backend) | `homeassistant/components/marketplace/` in `home-assistant/core`; `integration_type: system`, requirement `aiogithubapi==26.0.0` | https://github.com/home-assistant/core/tree/2026.11.2/homeassistant/components/marketplace , `manifest.json` |
| Marketplace panel (frontend) | `src/panels/marketplace/` and `src/data/marketplace/` in `home-assistant/frontend` | https://github.com/home-assistant/frontend/tree/20261028.6/src/panels/marketplace |
| User documentation | https://www.home-assistant.io/integrations/marketplace/ (page source last changed in commit `dc7a69447476f548a4688da9281ecda881c3547f`, 2026-11-11) | https://github.com/home-assistant/home-assistant.io/blob/dc7a69447476f548a4688da9281ecda881c3547f/source/_integrations/marketplace.markdown |
| Catalog list (what is « in the catalog ») | Repository `hacs/default`, one JSON array of `owner/repo` per category; dashboard cards are in the file `plugin`. The Marketplace names it `CATALOG_REPOSITORY = "hacs/default"` | `const.py` L43-45 at tag `2026.11.2`; https://github.com/hacs/default/tree/d1d62ffd9ceba8320c6de4d49f9bc81a29e22dbd (master, 2026-11-19) |
| Catalog data feed the Marketplace downloads | `https://data-v2.hacs.xyz` (default download profile; mirrors in the China profile) | `profiles.py` L88-92 at tag `2026.11.2` |
| Who builds that feed | Workflow `generate-hacs-data.yml` in `hacs/integration`, cron `0 */4 * * *` (every 4 hours), reading the `hacs/default` lists | https://github.com/hacs/integration/blob/8a543828351b963438a1613a6f06332138e4f4d6/.github/workflows/generate-hacs-data.yml L31-32, L128-148 |
| Validation action | `hacs/action` (Docker action, image `ghcr.io/hacs/action:main`, built from `action/Dockerfile` of `hacs/integration`) | see « Validation action » below |
| Developer documentation for publishers on home-assistant.io / developers / contributors | **None found.** The Marketplace page has no publisher section (no `hacs.json` fields, no file rules, no submission process); the 2026.11 release post only links to that page. `hacs/default` README and PR template still point to `hacs.xyz/docs/publish/*` | release post https://www.home-assistant.io/blog/2026/11/04/release-202611/ (read 2026-11-20); `hacs/default` `README.md` and `.github/PULL_REQUEST_TEMPLATE.md` at `d1d62ff` |

All core paths below are relative to `homeassistant/components/marketplace/` at tag `2026.11.2`; URL form `https://github.com/home-assistant/core/blob/2026.11.2/homeassistant/components/marketplace/<file>#L<a>-L<b>`. Read on 2026-11-20. The folder holds two `base.py` files: a bare `base.py` means the top-level `marketplace/base.py`; `repositories/base.py` is named in full.

## What the documentation says (source 1)

From https://www.home-assistant.io/integrations/marketplace/ (read 2026-11-20):

| Fact | Section |
|---|---|
| « A custom repository must meet the same requirements as the repositories in the catalog: it is a public repository on GitHub; it includes a `hacs.json` file that describes it; it holds an integration, dashboard, theme, or template and uses the folder structure required for its content type. » | Custom repositories |
| Adding a custom repository needs a GitHub connection (Settings > Marketplace > « Add from link », URL or `owner/repository`); the type can be chosen when it cannot be detected. | Custom repositories |
| A dashboard is installed in `www/community` and added as a dashboard resource; with YAML-managed resources the user adds it. Resources are served from `/local/community/`; old `/hacsfiles/` paths keep working. | Folder structure, Coming from HACS |
| « A custom repository without a `hacs.json` file stays installed, but the Marketplace cannot update it. » | Coming from HACS |
| Each installed repository gets an update entity. The catalog is checked every 6 hours; custom repositories with a GitHub connection every 48 hours. | Updates |
| Only stable releases are offered by default; a per-repository « Pre-release » switch (off by default) offers pre-releases. « Install another version » picks another version. | Updates |
| When the latest version needs a newer Home Assistant, the install dialog lists earlier versions. | Install |
| Not documented: `hacs.json` fields, file lookup, release rules, catalog submission. | — |

## `hacs.json` (source 2)

**Location**: must be at the repository root, at the ref being installed (the latest release tag when releases exist). The presence check in `common_validate` matches the file name anywhere in the tree (`repositories/base.py` L641-643, base name only), but the content is read from the root path only (L952): a `hacs.json` in a sub-folder passes the check and its keys are silently not applied. The file name is `RepositoryFile.REPOSITORY_MANIFEST = "hacs.json"` (`enums.py` L32-35). It is fetched with path `hacs.json` (root only) through the contents API at `version_to_install()` (`repositories/base.py` L945-959) or from raw at the catalog version (`repositories/base.py` L1964-1979, L2190-2195). Missing from the tree: validation error `repository_manifest_not_in_root` (« {repository} has no hacs.json in its root, the Marketplace needs one to install it. », `strings.json`), raised in `common_validate` (`repositories/base.py` L634-654); a repository with validation errors is not registered as a custom repository (`base.py` L872-879). Installing a version whose tree has no `hacs.json` fails with `version_without_repository_manifest` (`repositories/base.py` L2043-2051).

**Parsing**: only the keys of `REPOSITORY_MANIFEST_VALUES` are read; any other key is ignored silently; a value of the wrong type is ignored with a log warning « Ignoring <key> in hacs.json, <value> is not valid » (`utils/validate.py` L60-70; `repositories/base.py` L398-416). No key is required by the Marketplace itself.

| Key | Type | Default | Effect for a dashboard card | Source |
|---|---|---|---|---|
| `name` | string | none | Display name. Without it: repository name with `-` and `_` replaced by spaces, title-cased (`vacuum-map-card` gives « Vacuum Map Card »). For catalog repositories the feed's `manifest.name` overwrites it. | `repositories/base.py` L500-514, L152; `base.py` L1248-1251 |
| `filename` | string | none | When set, the **only** accepted card file name (release asset or tree file). When not set, see « Card file » below. A `/` in the name is cut to its last part with a warning when building the resource URL. | `repositories/plugin.py` L283-294, L384-396 |
| `homeassistant` | string, valid AwesomeVersion | none | Minimum Home Assistant version. Install of a version whose `hacs.json` names a newer one fails with « This version requires Home Assistant {version} or newer. ». The list's `can_install` flag uses it only when the repository has releases; the frontend then offers earlier versions. | `utils/validate.py` L53-57; `repositories/base.py` L586-594, L2055-2067; frontend `src/panels/marketplace/dialogs/dialog-marketplace-install.ts` L126-132 at tag `20261028.6` |
| `content_in_root` | bool | `false` | `true`: release assets are never looked at and `dist/` is never looked at; only root files. | `repositories/plugin.py` L231, L321, L340-350 |
| `zip_release` | bool | `false` | With `filename` ending in `.zip`, the content comes from that ZIP release asset, extracted into the card folder. Catalog installs of such a repository fall back to the GitHub API path. Not needed for a single `.js`. | `repositories/base.py` L601-611, L728-753, L1262-1267, L2217-2220 |
| `persistent_directory` | string | none | A sub-folder kept across updates (backed up and restored). | `repositories/base.py` L1376-1408 |
| `hide_default_branch` | bool | `false` | Sent to the frontend in the repository info (`websocket/repository.py` L126) but not referenced by the frontend Marketplace files at tag `20261028.6`. Visible effect « à vérifier »: confirm by a grep of the frontend at a later tag or a test install. | as cited |
| `hacs` | string | none | Read and kept, never compared (« names a version of the custom integration »). | `repositories/base.py` L386, L2057-2058 |
| `render_readme` | — | — | **Not read** by the Marketplace (not in `REPOSITORY_MANIFEST_VALUES`). The README is always shown, see below. | `utils/validate.py` L61-70 |
| `country` | — | — | **Not read** from `hacs.json`; accepted but ignored in catalog data (« Accepted for existing repositories, the Marketplace ignores it »). | `utils/validate.py` L61-70, L133-137 |

**README rendering**: the repository page shows the first of `README.md`, `readme.md`, `readme.MD`, `README.MD`, `README`, `readme` found in the root, at the installed version (or the available one when not installed); `<svg` tags are disabled (`repositories/base.py` L79-86, L961-976, L1911-1953). `info.md` is not read. The frontend renders it with `ha-markdown`; relative links and images resolve against the repository at that version (`.md` files open on GitHub, others come from raw) (frontend `src/panels/marketplace/dashboards/ha-marketplace-repository-dashboard.ts` L462, L492, L543-547 and `src/panels/marketplace/tools/markdown.ts` at tag `20261028.6`).

**The validation action is stricter than the Marketplace** (see below): it requires `name` and rejects unknown keys.

## Card file (source 2)

A dashboard card is category `plugin` (« Dashboard resources, the catalog calls them plugins », `enums.py` L11).

**Accepted names**, in order (`repositories/plugin.py` L283-294): `filename` from `hacs.json` if set, otherwise, with `<name>` the repository name (the part after `/`, `repositories/base.py` L338-343):
1. `<name without "lovelace-">.js`
2. `<name>.js`
3. `<name>.umd.js`
4. `<name>-bundle.js`

**Where it is looked for** (custom repository, `update_filenames`, `repositories/plugin.py` L313-350):
1. **Assets of the latest release** (the newest stable release, or pre-release when the Pre-release switch is on), unless `content_in_root` is `true`. First accepted name present as an asset wins; content is then « release » (single file mode).
2. Otherwise the **tree at the installed ref**: for each accepted name in order, the **root** first, then **`dist/`** (skipped when `content_in_root` is `true`).
3. Nothing found: error `structure_not_compliant` (« {repository} has no content the Marketplace can install in version {version}. ») (`repositories/plugin.py` L163-188, L211-224).

Type detection for « Add from link » uses the same lookup, and a dashboard is only detected when the resolved file ends in `.js` (`base.py` L797-836; `repositories/plugin.py` L190-196).

**Catalog installs** of the version named by the feed first probe `https://github.com/<repo>/releases/download/<tag>/<name>` for each accepted name (not with `content_in_root`); found, every asset of that release is downloaded. Otherwise the tag archive is downloaded and the same root/`dist/` lookup runs on it; files marked `export-ignore` are not in the archive (`repositories/plugin.py` L226-281; `repositories/base.py` L2131-2251).

**Several files**:
- Release: **every asset of the release** is downloaded into the card folder, the resource points at the matched one (`repositories/plugin.py` L248-281; `repositories/base.py` L810-830, L1742-1779). Total asset size limit 100 MiB (`const.py` L34-36; `release_too_large`).
- Root: every `.js` file of the root is downloaded (`repositories/plugin.py` L81-96).
- `dist/`: every file below `dist/`, sub-folders included, is downloaded (falls through to `gather_tree_files_to_download`, `repositories/base.py` L1715-1733).
- Only one dashboard resource is registered, for the matched file.

**Install target and resource** (`repositories/plugin.py`, `const.py` L15-18):
- Folder `<config>/www/community/<repository name>` (owner left out; a second installed repository with the same name is refused, `plugin_owned`). The folder name is kept after a GitHub rename (L47-56, L99-118).
- After install, the file must exist, else `installed_resource_missing` (L120-132).
- In storage mode the resource `{"res_type": "module", "url": "/local/community/<name>/<file>?v=<repository id>-<url-encoded version>"}` is added or updated; in YAML mode nothing is written (L352-463). If `www/` did not exist at startup, a repair asks for a restart (L140-152).

## Releases (source 2, and source 1 for pre-releases)

| Fact | Source |
|---|---|
| Releases are **not required** by the Marketplace: without releases the repository follows the default branch and the version shown is the short commit SHA (7 chars). | `repositories/base.py` L542-556, L1888-1909, L2321-2329 |
| Releases are read from the GitHub releases API (latest 30); **drafts are skipped**; a tag containing `?`, `#`, `%`, `\`, whitespace or a `.`-starting segment is skipped. | `repositories/base.py` L1478-1495, L1592-1627; `utils/validate.py` L31-41 |
| `last_version` = **tag name** (not the release title) of the newest non-pre-release. `prerelease` = newest pre-release when it is newer than that stable one. | `repositories/base.py` L1610-1617 |
| Version shown as « available » = `prerelease` when the repository's Pre-release switch is on and one exists, else `last_version`, else the last commit. The update entity's `latest_version` is that value; its release URL is `https://github.com/<repo>/releases/tag/<version>`. | `repositories/base.py` L542-551; `update.py` L75-91 |
| Update detection compares installed and available versions with AwesomeVersion (newer only when both strategies are known; else « different »). AwesomeVersion 25.8.0 (pinned in core 2026.11.2 `package_constraints.txt`) recognises a `v`/`V` prefix. | `utils/version.py` L12-34; `repositories/base.py` L558-584; `ludeeus/awesomeversion` `awesomeversion/awesomeversion.py` L251-257 at tag `25.8.0` |
| Release notes of up to 5 releases feed the update entity. | `const.py` L31-32; `update.py` L167-209 |
| When only pre-releases exist and the switch is off, the version to install is the default branch; a card whose built file only exists as a release asset then has nothing to install (`structure_not_compliant`). Consequence derived from the code above, not tested. | `repositories/base.py` L1888-1909, L1620-1624; `repositories/plugin.py` L319-350 |
| The catalog (and so the feed) only names a version for repositories with releases. | `repositories/base.py` L2160-2161, L2304-2306 |

## Catalog submission (source 2 for the catalog repository; process only documented on hacs.xyz)

Facts from `hacs/default` at commit `d1d62ffd9ceba8320c6de4d49f9bc81a29e22dbd` (read 2026-11-20):

| Fact | Source file |
|---|---|
| Submission = pull request to `hacs/default` (branch `master`) adding `"owner/repo"` to the JSON array in the file `plugin`. The arrays must stay sorted with `str.casefold`. | `plugin`; `scripts/is_sorted.py`; `.github/workflows/lint.yml` L27, L56-71 |
| PR template checklist: read the publishing docs (hacs.xyz); HACS action added to the repository and passing **without disabled checks**; link to the current release; link to the successful HACS action run (without `ignore`); a new release created after the actions passed. Template last changed 2025-12-15 (`ab3e23f`). | `.github/PULL_REQUEST_TEMPLATE.md` |
| Checks on pull requests to `hacs/default`: **Editable PR** runs on every pull request; the others run on pull requests labelled « New default repository »: **Owner** (submitter is the repository owner, or a non-bot contributor with at least a third of the top contributor's commits); **Editable PR** (« Allow edits by maintainers » on, unless the branch is in `hacs/default`, see above); **Releases** (`/releases` not empty); **Removed** (not in the removed list); **Existing** (not already listed); **HACS action** (`hacs/action@main` with the detected category). Hassfest and core domain conflict run for integrations only. | `.github/workflows/checks.yml`; `scripts/check/owner.py`, `edits.py`, `releases.py`, `removed.py`, `existing.py` |

How long reviews take, and whether Home Assistant staff now review submissions: « à vérifier » (no source 1 or 2 statement; confirm with an official publisher page or the `hacs/default` contributing rules).

### Validation action

| Fact | Source |
|---|---|
| Name « HACS Action », repository `hacs/action`, default branch `main`, inputs `category` (required), `repository`, `ignore`, `comment`, `github_token`; runs the Docker image `ghcr.io/hacs/action:main`. | `action.yml` at `hacs/action` commit `1ebf01c408f29afcb6406bd431bc98fd8cbb15aa` (2026-06-08, latest commit on `main` on 2026-11-20) |
| **Latest release: `22.5.0`**, published 2022-05-28, tag commit `d556e736723344f83838d08488c983a15381059a`. The catalog itself runs `hacs/action@main`. Pinning `hacs/action` to a SHA does not pin the image, which is always `:main`. | `gh api repos/hacs/action/releases/latest`, `.../git/ref/tags/22.5.0`; `hacs/default` `checks.yml` |
| The image is built from `hacs/integration` (`action/Dockerfile`, `action/action.py`, the HACS custom integration code) on every push to `main` touching it. So the action validates with the **HACS** code, not with the Marketplace code in core. | `hacs/integration` at `8a543828351b963438a1613a6f06332138e4f4d6`: `.github/workflows/action-container.yml` L1-20, L51-64; `action/Dockerfile` |

Checks the action runs for category `plugin` (`custom_components/hacs/validate/*.py` at `hacs/integration` `8a54382`; `manager.py` drops checks of other categories and the ones named in `ignore`):

| Check | Rule |
|---|---|
| `archived` | Repository not archived |
| `description` | GitHub repository description set |
| `topics` | At least one topic. In action mode the topics are **not** filtered (`custom_components/hacs/repositories/base.py` L207-208 filters `TOPIC_FILTER` only when not running as the action; `action/action.py` sets it), so any topic passes. `TOPIC_FILTER` (`home-assistant`, `homeassistant`, `hacs`, `lovelace`, `lovelace-ui`, `custom-card`, `custom-cards`, `plugin`, `smart-home`, `home-automation`, ...; full list L57-102) only hides topics from what is displayed; the Marketplace applies an almost identical filter before showing topics (`repositories/base.py` L88-131, L371-374 in core). Corrected in #11 |
| `issues` | Issues enabled |
| `information` | A `README`, `README.md`, `info` or `info.md` in the tree |
| `images` | The README has a line with `<img` or `![` that is not a shield (`-shield`, `img.shields.io`) or `buymeacoffee.com` |
| `hacsjson` | `hacs.json` in the tree and valid against `HACS_MANIFEST_JSON_SCHEMA`: **`name` required (string)**; optional `content_in_root`, `country`, `filename`, `hacs`, `hide_default_branch`, `homeassistant` (string), `persistent_directory`, `render_readme`, `zip_release`; **extra keys rejected** (`PREVENT_EXTRA`) (`custom_components/hacs/utils/validate.py` L78-92) |
| `license` | GitHub detects a licence with an SPDX id that is OSI-approved (`MIT` is in the built-in list) |
| `brands` | Integrations only: not a requirement for a card |
| `integration_manifest`, `integration_categories` | Integrations only |

The action also registers the repository with HACS, which resolves the card file with HACS's own plugin logic. That lookup is the same as the Marketplace's: the same four accepted names in the same order (or only `filename` when set), the assets of the newest release first unless `content_in_root`, then root before `dist/` for each name (`custom_components/hacs/repositories/plugin.py` L99-135 at `hacs/integration` `8a543828351b963438a1613a6f06332138e4f4d6`). When no file is found, registration raises « Repository structure ... is not compliant » (L38-49) and the action exits with « not loaded properly » (`action/action.py`); this consequence is read from the code, not from a run.

## Pre-Marketplace rules (hacs.xyz, not current facts)

Read 2026-11-20; every page carries the banner « HACS is built into Home Assistant as the Marketplace, starting with 2026.11 ».

| Page | Old rule | Marketplace code (2026.11.2) |
|---|---|---|
| https://www.hacs.xyz/docs/publish/plugin/ | `.js` in `dist/` or root, named after the repository (or without `lovelace-`); lookup `dist`, latest release, root; all `.js` files of the first matching location are downloaded; users pick from the last 5 releases or the default branch | Lookup is **release assets first**, then per name root before `dist/`; accepted names add `.umd.js` and `-bundle.js`; release installs take every asset; the version list is up to 30 releases |
| https://www.hacs.xyz/docs/publish/include/ | Default repository requirements: works as a custom repository, public on GitHub, HACS action (no ignored checks), full GitHub release after the actions pass, owner or major contributor, description, issues, topics, README images for plugins, OSI licence, `hacs.json` with at least `name`, PR to `hacs/default` in alphabetical order from a personal account, editable | Matches the checks in `hacs/default` at `d1d62ff` listed above |

## « à vérifier »

| Item | What would confirm it |
|---|---|
| An official publisher guide for the Marketplace (home-assistant.io, developers, contributors) | A page on those sites; none found on 2026-11-20 |
| Effect of `hide_default_branch` in the 2026.11 frontend | Frontend grep at a later tag, or an install of a repository that sets it |
| Review time and reviewers of `hacs/default` submissions | Official statement or `hacs/default` contributing docs |
| The release post's « a GitHub connection will be required in the future » for manually added repositories (secondary summary) versus the doc page's « Custom repositories require a GitHub connection » | Re-read the release post section in full |
| Minimum Home Assistant version of this card | Epic 2 |

## Gaps for this card

Current state: public MIT repository; the build writes exactly `dist/vacuum-map-card.js` and its source map `dist/vacuum-map-card.js.map` (owner decision, #9); `dist/` is Git-ignored, so the tree never holds the card file and both the Marketplace and the HACS action can **only** find it as a release asset.

### Order of work

Until a stable release carrying `vacuum-map-card.js` exists, from a commit that already contains `hacs.json`:

- « Add from link » cannot detect the type, and choosing « Dashboard » by hand fails with `structure_not_compliant` (core `base.py` L797-836, L872-879; `repositories/plugin.py` L161-196).
- The HACS action fails (see « Validation action »).

So the order is:

1. Merge #9 (release workflow).
2. Merge #11 (`hacs.json`, action workflow).
3. Cut the first stable release `vX.Y.Z`.
4. Then run the « Add from link » check and expect the action to go green.

Proposed amendment to #11: move its manual « Add from link » check after the first release, and do not make the HACS action a required status check before then.

### What #9 (release workflow) must do

1. On tag `vX.Y.Z`, publish a **full GitHub release** from that tag, with the asset named exactly **`vacuum-map-card.js`**. It must match `filename` in `hacs.json` (owner decision: set explicitly).
2. Create the release as a **draft**, upload the assets, then publish it, or use one command that publishes only once the uploads succeed.
   - Drafts are skipped (`repositories/base.py` L1490).
   - A published stable release without its card file makes the lookup fall back to the tree, which has no built file. Every install and update then fails with `structure_not_compliant` until the release is fixed (`repositories/plugin.py` L313-350).
3. Assets: every asset is downloaded into `www/community/vacuum-map-card/` (100 MiB total).
   - Owner decision: also ship the source map `vacuum-map-card.js.map`. It is served next to the card, so browsers can load it. Attach nothing else.
4. The **first** release must be a stable release, not a pre-release: with only pre-releases the Marketplace falls back to the default branch, which has no built file.
5. The tagged commit must already contain `hacs.json` (#11) and the README: both are read at the tag.
6. The version users see is the **tag name**, `v` included (`v0.1.0`; owner decision: keep the `v` prefix).
   - The release body becomes the update entity's release notes; keep it ASCII (project rule).
7. Tag names must avoid `?`, `#`, `%`, `\`, whitespace and dot-starting segments (`vX.Y.Z` is fine).
8. Catalog prerequisite: create a new release **after** the HACS action is green (PR template).

### What #11 (Marketplace metadata) must do

1. Add `hacs.json` at the repository root, with only keys of the action's schema (extra keys fail it):
   - `name` (required by the HACS action);
   - `filename: "vacuum-map-card.js"` (owner decision);
   - `homeassistant` once the minimum version is confirmed (see below).
   - Do **not** set `content_in_root` (it disables the release lookup) or `zip_release`. `render_readme` is ignored by the Marketplace; leave it out.
2. Repository settings (owner, not a file): description; topics with at least one outside the filter list; issues enabled. The MIT licence is already detectable.
3. Add a workflow running `hacs/action` with `category: plugin` on push, pull request and a schedule, and no `ignore`.
   - Owner decision: pin it by commit SHA, knowing the image is always `ghcr.io/hacs/action:main`.
   - It goes green only after the first release (see « Order of work »).
4. The `images` check needs a non-badge image in the README, and #11 currently lists README changes as out of scope.
   - Owner decision: an image of the card in the README, added in #11. While the card only shows its title, it is a capture of the current card (nothing from a real home), with a visible caption saying so. Epic 6 replaces it with a capture of the working card built from anonymised fixture data, in the default theme, at 2x.
   - The Marketplace frontend keeps a relative `src`/`srcset` only with a `./` prefix (`src/resources/markdown-worker.ts`, xss `safeAttrValue`, frontend `20261028.6`) and rewrites it to the repository's raw URL at the version (`src/panels/marketplace/tools/markdown.ts`): use `./docs/...` paths.
   - The README install instructions stay in Epic 6.

### Owner decisions (2026-11-20)

| Question | Decision |
|---|---|
| `v` prefix in tags | Keep it (`v0.1.0`) |
| Minimum Home Assistant version | « 2025 », read as `2025.1.0`, to confirm by the owner and by Epic 2: the card must then fall back to the integration's room action where `vacuum.clean_area` does not exist yet, and every Home Assistant API it uses must exist in 2025.1. Note: the Marketplace itself exists from 2026.11; older versions install through HACS. |
| `filename` in `hacs.json` | Set explicitly |
| HACS action pinning | Pin by commit SHA |
| Repository topics | Open: proposal in #11, set by the owner |
| README image | Capture of the current card in #11 (2026-11-20 follow-up decision); real card from fixture data in Epic 6 |
| Source map as a release asset | Yes |
| Catalog submission (Epic 6) | When the card is ready. PR to `hacs/default` from the owner's personal account with « Allow edits by maintainers », after a release made once the action is green |

No upstream issue is drafted: nothing blocks this card in the Marketplace code; the missing publisher documentation could be raised with `home-assistant/home-assistant.io` if the owner wishes.
