# ADR 0001: Stack

- Status: proposed (to be confirmed by the bootstrap issue)
- Date: 2026-11-20

## Context

Home Assistant loads custom cards as JavaScript modules registered as dashboard resources. Its own frontend is built with Lit web components, and community cards overwhelmingly use Lit and TypeScript. The card must be small, fast to load on wall tablets, and maintainable by contributors.

## Decision

- **Language**: TypeScript, `strict` and the strictest checks the compiler offers, no `any`.
- **UI**: Lit web components, reusing Home Assistant's own elements (`ha-card` and others available at runtime) and theme CSS variables.
- **Build**: one bundler producing a single ES module in `dist/`, minified, with a size report. Which bundler (Rollup or Vite library mode) is decided in the bootstrap issue after `/check-versions`.
- **Tests**: Vitest; a DOM environment for `ui` tests (happy-dom or jsdom, decided in the bootstrap issue).
- **Lint and format**: Biome.
- **Package manager**: pnpm, pinned through `packageManager`.
- **Node.js**: current LTS for tooling only (the card runs in the browser).

Exact versions live in `docs/standards.md`, filled by `/check-versions`, never from memory.

## Consequences

- Contributors need Node.js and pnpm only.
- The card depends on Home Assistant's frontend at runtime for some elements: every such element is listed in `docs/research/ha-frontend.md` with the Home Assistant version it was verified on, and the card falls back to its own minimal markup when one is missing.
