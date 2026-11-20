# ADR 0001: Stack

- Status: accepted
- Date: 2026-11-20 (proposed and accepted, #5)

## Context

Home Assistant loads custom cards as JavaScript modules registered as dashboard resources. Its own frontend is built with Lit web components, and community cards overwhelmingly use Lit and TypeScript. The card must be small, fast to load on wall tablets, and maintainable by contributors.

## Decision

- **Language**: TypeScript, `strict` and the strictest checks the compiler offers, no `any`.
- **UI**: Lit web components, reusing Home Assistant's own elements (`ha-card` and others available at runtime) and theme CSS variables.
- **Build**: Vite in library mode producing a single ES module in `dist/`, minified, with a size report. Measured setup (see « Measurements »): `build.minify: true`, `build.rolldownOptions.output.minify: true` and `build.rolldownOptions.output.comments: { legal: true }`.
- **Tests**: Vitest, with happy-dom as the DOM environment for `ui` tests.
- **Lint and format**: Biome.
- **Package manager**: pnpm, pinned through `packageManager`.
- **Node.js**: current LTS for tooling only (the card runs in the browser).

Exact versions live in `docs/standards.md`, filled by `/check-versions`, never from memory.

## Measurements (2026-11-20)

Versions from `docs/standards.md`, measured in a throw-away project outside the repository. Entry module, plain JavaScript (TypeScript compilation was not measured): one `LitElement` subclass with `static styles = css`...``, a `render()` returning `html`...`` and `customElements.define`. Sizes are `wc -c` of the output (raw) and `gzip -9 | wc -c` (gzip).

### Bundler

| | Vite 8.3.8 (Rolldown resolved to 1.2.19) | Rollup 4.68.3 |
|---|---|---|
| Plugins needed | none (Vite transpiles TypeScript itself, not measured here) | `@rollup/plugin-node-resolve` 16.0.3 and `@rollup/plugin-terser` 1.0.2 (measured), plus a TypeScript plugin such as `@rollup/plugin-typescript` 12.3.1 (not measured) |
| Output | 1 file, no dynamic `import()` | 1 file, no dynamic `import()` |
| `build.minify: true` only | 19 388 B raw, 6 496 B gzip, 518 lines: in library ES mode the output keeps its whitespace | n/a |
| Minified, licence headers kept | 15 567 B raw, 5 929 B gzip (the measured setup above) | 15 553 B raw, 5 947 B gzip (terser defaults) |
| Minified, licence headers dropped | 15 220 B raw, 5 833 B gzip | n/a |
| Last release of each package needed | Vite 2026-11-11, Rolldown 1.2.19 2026-11-11 | Rollup 2026-11-13, `@rollup/plugin-terser` 2026-10-21, `@rollup/plugin-typescript` 2026-10-21, `@rollup/plugin-node-resolve` 2025-10-13 |
| `node_modules` (pnpm, this entry only) | 41 303 kB, 54 packages | 18 284 kB, 64 packages |

**Choice: Vite.** Same output size once both minify fully. Rollup needs `@rollup/plugin-node-resolve`, which has had no release for over a year and so fails the dependency rule (a release in the last six months). The install size difference does not count: Vitest 5.1.0 has `vite` as a required peer dependency (`npm view vitest@5.1.0 peerDependencies.vite` = `^6.4.0 || ^7.0.0 || ^8.0.0`, not optional), so Vite is installed anyway, and Rollup would come on top of it. Vite also shares its configuration with Vitest.

Lit 3.3.3 (2026-05-14) is also just outside the six-month window. It stays: it is the UI decision of this ADR, with no alternative weighed here, and `/check-versions` re-checks it each time. The Rollup plugin is different: a maintained alternative (Vite) does the same job.

Lit's licence is BSD-3-Clause; its `@license` headers stay in the bundle (`comments: { legal: true }`), at a cost of 347 B raw, 96 B gzip.

### Lit's share of the bundle

- Whole entry: 15 567 B raw, 5 929 B gzip.
- Card code alone, built the same way with `lit` and `@lit/*` external: 215 B raw, 194 B gzip.
- Lit core (`LitElement`, `html`, `css`) therefore accounts for about 15.35 kB raw. Directives (`classMap`, `repeat`, `styleMap`, …) are separate modules and are not included; the card will likely add some.

Lit stays under the 20 kB threshold for a dependency that needs an owner decision.

### DOM environment

Same Vitest 5.1.0 test run with `--environment happy-dom` and `--environment jsdom`. The test defines a `LitElement`, renders an SVG path and a button into the shadow root, updates a property, dispatches a `composed` event from the shadow root to `document`, and focuses the button (`shadowRoot.activeElement`).

| | happy-dom 21.0.4 | jsdom 31.0.1 |
|---|---|---|
| Test | passes | passes |
| Run time (one test, Vitest total) | 2.40 s | 3.81 s |
| Custom elements and shadow DOM | README lists « Custom Elements (Web Components) » and « Declarative Shadow DOM »; imperative `attachShadow` (used by Lit) shown by the test | not listed in the README; shown by the test |
| Layout (`getBoundingClientRect`) | not checked | not implemented (README) |
| Direct dependencies | 7 | 18 |
| Last release | 2026-10-20 | 2026-11-13 |

**Choice: happy-dom.** Its support for custom elements is documented, and the test shows Lit's shadow DOM works; it starts faster and has fewer dependencies. Neither environment does layout. That is no loss here: hit tests and geometry live in `domain` as pure functions, and they are tested without a DOM.

## Consequences

- Contributors need Node.js and pnpm only.
- The card depends on Home Assistant's frontend at runtime for some elements: every such element is listed in `docs/research/ha-frontend.md` with the Home Assistant version it was verified on, and the card falls back to its own minimal markup when one is missing.
