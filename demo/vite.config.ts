// Dev server of the demo page (`pnpm run demo`). It is never built: the card's build (`vite.config.ts`) bundles
// `src/index.ts` only, and `scripts/size.mjs` checks that no demo or test file reaches `dist/`.
import { defineConfig } from "vite";
import packageJson from "../package.json" with { type: "json" };

export default defineConfig({
  // Relative to the working directory: `pnpm run demo` runs from the repository root.
  root: "demo",
  // The same replacement as the card's build.
  define: { __CARD_VERSION__: JSON.stringify(packageJson.version) },
  server: {
    // Only on this machine.
    host: "localhost",
    strictPort: true,
    // Only what the page loads (paths relative to `root`): never Git-ignored local files of the repository root.
    fs: { allow: [".", "../src", "../test", "../node_modules"] },
  },
});
