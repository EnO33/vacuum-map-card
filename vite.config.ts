import { defineConfig } from "vitest/config";
import packageJson from "./package.json" with { type: "json" };

const coverageFloor = { lines: 90, branches: 90 };

export default defineConfig({
  define: {
    __CARD_VERSION__: JSON.stringify(packageJson.version),
  },
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => `${packageJson.name}.js`,
    },
    outDir: "dist",
    emptyOutDir: true,
    minify: true,
    rolldownOptions: {
      output: {
        minify: true,
        comments: { legal: true },
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.d.ts"],
      thresholds: {
        "src/domain/**": coverageFloor,
        "src/app/**": coverageFloor,
      },
    },
  },
});
